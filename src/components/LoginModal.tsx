import { BrandLoginForm } from "./BrandLoginForm";
import { User } from "firebase/auth";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onSignInSuccess: (user: User) => void;
  allowClose?: boolean;
}

export function LoginModal({
  isOpen,
  onClose,
  onSignInSuccess,
  allowClose = true
}: LoginModalProps) {

  if (!isOpen) return null;

  return (
    <div className={!allowClose ? "modal-static" : "modal-overlay"} onClick={allowClose ? onClose : undefined}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {allowClose && <button className="close-btn" onClick={onClose}>✕</button>}
        {/* Header removed from here as it's inside the form now for better flow */}
        
        <BrandLoginForm onSignInSuccess={onSignInSuccess} />
      </div>
    </div>
  );
}
