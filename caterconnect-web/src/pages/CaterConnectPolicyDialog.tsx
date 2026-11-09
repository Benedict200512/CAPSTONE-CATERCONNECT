import { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import {
  POLICY_SECTIONS,
  POLICY_VERSION,
  type PolicyRole,
} from './CaterConnectPolicies';
import './CaterConnectPolicyDialog.css';

type CaterConnectPolicyDialogProps = {
  initialRole: PolicyRole;
  onClose: () => void;
};

export default function CaterConnectPolicyDialog({
  initialRole,
  onClose,
}: CaterConnectPolicyDialogProps) {
  const [role, setRole] = useState<PolicyRole>(initialRole);
  const closeRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const modal = contentRef.current;
      if (!modal) return;
      const focusable = [...modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="cc-policy-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="cc-policy-dialog"
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-policy-title"
        aria-describedby="cc-policy-subtitle"
      >
        <div className="cc-policy-head">
          <span className="cc-policy-symbol" aria-hidden="true"><FileText size={22} /></span>
          <div className="cc-policy-heading-group">
            <h2 id="cc-policy-title">CATERCONNECT Policies &amp; Terms</h2>
            <p id="cc-policy-subtitle">Version {POLICY_VERSION}</p>
          </div>
          <button ref={closeRef} type="button" className="cc-policy-close" onClick={onClose} aria-label="Close policies">
            <X size={22} />
          </button>
        </div>

        <div className="cc-policy-tabs" aria-label="Select policy type">
          <button type="button" className={role === 'customer' ? 'active' : ''} aria-pressed={role === 'customer'} onClick={() => setRole('customer')}>
            Customer Terms
          </button>
          <button type="button" className={role === 'caterer' ? 'active' : ''} aria-pressed={role === 'caterer'} onClick={() => setRole('caterer')}>
            Caterer Terms
          </button>
        </div>

        <div className="cc-policy-sections" key={role}>
          {POLICY_SECTIONS[role].map(({ heading, body }, index) => (
            <section className="cc-policy-section" key={heading}>
              <h3><span>{String(index + 1).padStart(2, '0')}</span>{heading}</h3>
              <p>{body}</p>
            </section>
          ))}
        </div>
        <div className="cc-policy-foot">
          <p>These are the supplied platform terms. A separate complete Privacy Notice is not included.</p>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
