'use client';

import { useEffect, useRef, useState } from 'react';

const BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'itf',
];

export default function CameraBarcodeScanner({
  open,
  title = 'Scan Barcode',
  description = 'Point the camera at the product barcode.',
  onClose,
  onDetected,
  continuous = false,
  cooldownMs = 1400,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const lockRef = useRef(false);
  const lastScanRef = useRef({ value: '', at: 0 });
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [starting, setStarting] = useState(false);
  const [lastScannedValue, setLastScannedValue] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const stopScanner = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      lockRef.current = false;
    };

    const scanFrame = async () => {
      if (
        cancelled ||
        !videoRef.current ||
        !detectorRef.current ||
        videoRef.current.readyState < 2 ||
        lockRef.current
      ) {
        frameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes?.length) {
          const value = String(barcodes[0].rawValue || '').trim();
          if (value) {
            const now = Date.now();
            const duplicateWithinCooldown =
              continuous &&
              lastScanRef.current.value === value &&
              now - lastScanRef.current.at < cooldownMs;

            if (duplicateWithinCooldown) {
              frameRef.current = requestAnimationFrame(scanFrame);
              return;
            }

            lockRef.current = true;
            lastScanRef.current = { value, at: now };
            setLastScannedValue(value);
            await onDetected?.(value);

            if (continuous) {
              window.setTimeout(() => {
                lockRef.current = false;
              }, 700);
              frameRef.current = requestAnimationFrame(scanFrame);
              return;
            }

            stopScanner();
            return;
          }
        }
      } catch (scanError) {
        setError(scanError.message || 'Unable to scan barcode.');
      }

      frameRef.current = requestAnimationFrame(scanFrame);
    };

    const startScanner = async () => {
      setError('');
      setStarting(true);
      setLastScannedValue('');

      try {
        const DetectorClass = window.BarcodeDetector;
        if (!DetectorClass) {
          setSupported(false);
          return;
        }

        detectorRef.current = new DetectorClass({ formats: BARCODE_FORMATS });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        frameRef.current = requestAnimationFrame(scanFrame);
      } catch (startError) {
        setError(startError.message || 'Camera permission denied or unavailable.');
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal scanner-modal">
        <div className="scanner-modal-top">
          <div>
            <div className="scanner-modal-title">{title}</div>
            <div className="scanner-modal-copy">{description}</div>
          </div>
          <button type="button" className="scanner-close-button" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}

        {!supported ? (
          <div className="alert-warning">
            This browser does not support camera barcode detection yet. Try Chrome on Android or scan later from another device.
          </div>
        ) : null}

        {continuous && supported ? (
          <div className="alert-info" style={{ marginBottom: 12 }}>
            Continuous scan is on. Keep scanning products and tap Close when you are done.
          </div>
        ) : null}

        <div className="scanner-video-frame">
          <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
          <div className="scanner-target-box" />
        </div>

        <div className="scanner-help-text">
          {starting ? 'Starting camera...' : continuous ? 'Barcode add hote hi scanner open rahega for next item.' : 'Keep the barcode inside the box and hold the phone steady.'}
        </div>

        {lastScannedValue ? (
          <div className="alert-success" style={{ marginTop: 12 }}>
            Last scanned: <strong>{lastScannedValue}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
