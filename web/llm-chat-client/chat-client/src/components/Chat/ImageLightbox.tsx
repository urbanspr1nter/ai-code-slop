import { X } from 'lucide-react';
import './ImageLightbox.css';
import { useEffect } from 'react';

interface ImageLightboxProps {
    src: string;
    onClose: () => void;
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="lightbox-overlay" onClick={onClose}>
            <button className="lightbox-close" onClick={onClose} title="Close">
                <X size={24} />
            </button>
            <img
                src={src}
                alt="Full view"
                className="lightbox-image"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}
