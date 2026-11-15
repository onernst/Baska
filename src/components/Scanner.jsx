import { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new window.BarcodeDetector({ formats });
    } catch {
      // fall through to the bundled scanner
    }
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: FORMATS });
}

// Looks the barcode up in Open Food Facts (free, public product database).
async function lookupProduct(code) {
  if (!/^\d{8,14}$/.test(code)) return null;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const name = (data.product.product_name || '').trim();
    const brand = (data.product.brands || '').split(',')[0].trim();
    if (!name) return null;
    return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  } catch {
    return null;
  }
}

export default function Scanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser can’t use the camera. Type the item instead.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = await makeDetector();
        setStatus('Point the camera at a barcode');

        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length && codes[0].rawValue) {
              stopped = true;
              const code = codes[0].rawValue.trim();
              setStatus('Found it. Looking up the product…');
              stream.getTracks().forEach((t) => t.stop());
              const name = await lookupProduct(code);
              onResult({ code, name });
              return;
            }
          } catch {
            // keep scanning
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          setError('Camera access was blocked. Allow the camera for this site, or type the item instead.');
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setError('No camera found on this device. Type the item instead.');
        } else {
          setError(err?.message || 'Couldn’t start the camera.');
        }
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop scanner-backdrop" onClick={onClose}>
      <div
        className="scanner-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Scan a product barcode"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="list-sheet-head">
          <h2>Scan a product</h2>
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {error ? (
          <p className="scanner-error">{error}</p>
        ) : (
          <>
            <div className="scanner-frame">
              <video ref={videoRef} muted playsInline />
              <span className="scanner-line" aria-hidden="true" />
            </div>
            <p className="scanner-status" role="status">
              {status}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
