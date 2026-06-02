const PetProfile = require('../models/petProfileModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

// GET /api/pets
const getPets = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { search } = req.query;
    const filter = { shop: shop._id, isActive: true };
    if (search) {
      filter.$or = [
        { ownerName:  { $regex: search, $options: 'i' } },
        { ownerPhone: { $regex: search, $options: 'i' } },
        { petName:    { $regex: search, $options: 'i' } },
      ];
    }
    const pets = await PetProfile.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(pets);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// GET /api/pets/owner?phone=xxx
const getPetsByOwnerPhone = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { phone } = req.query;
    if (!phone) return res.json([]);
    const pets = await PetProfile.find({ shop: shop._id, ownerPhone: { $regex: phone.slice(-10), $options: 'i' }, isActive: true }).sort({ createdAt: -1 });
    res.json(pets);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// POST /api/pets
const createPet = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { ownerName, ownerPhone, petName, species, breed, gender, dateOfBirth, color, weight, microchipNo, ownerAddress, medicalNotes, vetName, vetPhone, groomingFrequency } = req.body;
    if (!ownerName || !ownerPhone || !petName || !species) {
      return res.status(400).json({ message: 'ownerName, ownerPhone, petName and species are required' });
    }
    const pet = await PetProfile.create({ shop: shop._id, ownerName, ownerPhone, petName, species, breed, gender, dateOfBirth, color, weight, microchipNo, ownerAddress, medicalNotes, vetName, vetPhone, groomingFrequency });
    res.status(201).json(pet);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// PATCH /api/pets/:id
const updatePet = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const pet = await PetProfile.findOne({ _id: req.params.id, shop: shop._id });
    if (!pet) return res.status(404).json({ message: 'Pet profile not found' });
    const allowed = ['ownerName', 'ownerPhone', 'ownerAddress', 'petName', 'species', 'breed', 'gender', 'dateOfBirth', 'color', 'weight', 'microchipNo', 'medicalNotes', 'vetName', 'vetPhone', 'groomingFrequency', 'lastGroomedAt', 'allergies', 'isActive'];
    allowed.forEach(k => { if (req.body[k] !== undefined) pet[k] = req.body[k]; });
    await pet.save();
    res.json(pet);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// POST /api/pets/:id/vaccinate
const addVaccination = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const pet = await PetProfile.findOne({ _id: req.params.id, shop: shop._id });
    if (!pet) return res.status(404).json({ message: 'Pet profile not found' });
    const { vaccineName, givenDate, nextDueDate, vetName, notes } = req.body;
    if (!vaccineName) return res.status(400).json({ message: 'Vaccine name required' });
    pet.vaccinations.push({ vaccineName, givenDate, nextDueDate, vetName, notes });
    await pet.save();
    res.json(pet);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getPets, getPetsByOwnerPhone, createPet, updatePet, addVaccination };
