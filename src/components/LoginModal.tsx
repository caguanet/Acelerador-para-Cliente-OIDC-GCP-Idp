import { User } from "firebase/auth";
import { PasswordlessLoginForm } from "./PasswordlessLoginForm";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onSignInSuccess: (user: User) => void;
  onGoToRegister?: () => void;
  allowClose?: boolean;
}

export function LoginModal({
  isOpen,
  onClose,
  onSignInSuccess,
  onGoToRegister,
  allowClose = true
}: LoginModalProps) {

  if (!isOpen) return null;

  return (
    <div className={!allowClose ? "modal-static" : "modal-overlay"} onClick={allowClose ? onClose : undefined}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {allowClose && <button className="close-btn" onClick={onClose}>✕</button>}
        
        <PasswordlessLoginForm
          onSignInSuccess={onSignInSuccess}
          onGoToRegister={onGoToRegister ?? onClose}
        />
      </div>
    </div>
  );
}
