import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CircleHelp,
  Search,
  ChevronDown,
  Headphones,
} from "lucide-react";
import CustomerHeader from "./CustomerHeader";
import "./CustomerProfile.css";
import "./CustomerFAQ.css";

type FAQ = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

// Customer FAQ wording copied from the provided Mobile FAQScreen.tsx.
const CUSTOMER_FAQS: FAQ[] = [
  {
    id: "booking",
    category: "Bookings",
    question: "How do I book a catering service?",
    answer:
      "Browse caterers, select a package, enter your event details, customize your order, and submit your booking request. Track its status in Bookings.",
  },
  {
    id: "availability",
    category: "Bookings",
    question: "How do I know if a caterer is available?",
    answer:
      "Choose your event date during booking. Availability is checked before submission, but the caterer must still review and accept your request.",
  },
  {
    id: "downpayment",
    category: "Payments",
    question: "How do I pay the downpayment?",
    answer:
      "Open your booking and follow the payment instructions. Available payment methods are shown at checkout. Your payment status updates after verification.",
  },
  {
    id: "cancel",
    category: "Cancellations",
    question: "Can I cancel my booking?",
    answer:
      "Cancellation depends on the booking status. Review the cancellation details in your booking before confirming. Refund eligibility depends on the cancellation policy.",
  },
  {
    id: "refund",
    category: "Refunds",
    question: "How much of my downpayment can be refunded?",
    answer:
      "The refund amount depends on how many days remain before your event when you cancel. " +
      "30 days or more: 100% refund; " +
      "15–29 days: 75% refund; " +
      "8–14 days: 50% refund; " +
      "exactly 7 days: 25% refund; " +
      "fewer than 7 days: no refund. " +
      "Refund percentages are calculated based on the downpayment you have already paid.",
  },
  {
    id: "refund-grace-period",
    category: "Refunds",
    question: "What is the 24-hour cancellation grace period?",
    answer:
      "If you cancel within 24 hours after your downpayment was verified, you receive a 100% refund of the verified downpayment if your event is at least 7 calendar days away. " +
      "The 24 hours begin at payment verification, not booking creation or payment submission. " +
      "If fewer than 7 days remain before the event, no refund is due even during the grace period.",
  },
  {
    id: "caterer-cancel",
    category: "Refunds",
    question: "What happens if the caterer cancels my booking?",
    answer:
      "If the caterer cancels your booking, you are entitled to a 100% refund of your paid downpayment, regardless of how many days remain before the event. " +
      "The caterer is responsible for processing the refund.",
  },
  {
    id: "refund-time",
    category: "Refunds",
    question: "How does the refund process work?",
    answer:
      "Once a booking is cancelled and a refund is required, the caterer has 3 days (72 hours) to process the refund. " +
      "The caterer sends the refund and submits proof of the transaction. " +
      "The customer then confirms that the refund has been received. " +
      "If either party encounters a problem, they can flag the refund for Platform Staff to investigate. " +
      "Platform Staff monitors refund transactions but does not directly process refunds.",
  },
  {
    id: "account-appeal",
    category: "Account & Security",
    question: "How can I appeal a suspended account?",
    answer:
      "If your account has been suspended, log in to CaterConnect and follow the appeal instructions displayed on the suspension notice. Explain why you believe the suspension should be reviewed and submit your appeal to Platform Staff. If your appeal is rejected, you can review the explanation, edit your appeal, and resubmit it. If Platform Staff approves your appeal, it will be forwarded to the System Administrator for the final account reinstatement process.",
  },
  {
    id: "forgot-password",
    category: "Account & Security",
    question: "What should I do if I forget my password?",
    answer:
      "On the login screen, select Forgot Password and enter the email address registered to your CaterConnect account. Follow the password reset instructions sent to your email.",
  },
  {
    id: "reset-password",
    category: "Account & Security",
    question: "How can I reset my password?",
    answer:
      "If you cannot log in, select Forgot Password on the login screen and enter your registered email address. Follow the instructions sent to your email to create a new password. If you can still access your account, use the password-changing option in your account settings if available.",
  },
  {
    id: "complaint",
    category: "Support",
    question: "What if I have a problem with a caterer?",
    answer:
      "Use the Complaints section to report a serious issue. Include the booking details and a clear description so Platform Staff can review it.",
  },
  {
    id: "account",
    category: "Account",
    question: "How do I update my profile?",
    answer:
      "Open Profile and select Edit Profile to update the information available for your account.",
  },
];

export default function CustomerFAQ() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...new Set(CUSTOMER_FAQS.map((faq) => faq.category))],
    [],
  );
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return CUSTOMER_FAQS.filter(
      (faq) =>
        (category === "All" || faq.category === category) &&
        (!search ||
          `${faq.question} ${faq.answer}`.toLocaleLowerCase().includes(search)),
    );
  }, [query, category]);

  return (
    <div className="cc-profile-shell">
      <CustomerHeader activePage="profile" />
      <main className="cc-profile-main cc-profile-narrow">
        <Link className="cc-profile-back" to="/customer/profile">
          <ArrowLeft size={17} /> Back to Profile
        </Link>
        <div className="cc-profile-overline">
          <CircleHelp size={17} /> HELP CENTER
        </div>
        <h1>Frequently Asked Questions</h1>
        <p className="cc-profile-subtitle">
          Find answers to common CaterConnect customer questions.
        </p>
        <div className="cc-profile-faq-search">
          <Search size={19} />
          <input
            aria-label="Search customer FAQs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search FAQs..."
            type="search"
          />
        </div>
        <div className="cc-customer-faq-categories" aria-label="FAQ categories">
          {categories.map((name) => (
            <button
              type="button"
              key={name}
              className={
                name === category
                  ? "cc-customer-faq-chip selected"
                  : "cc-customer-faq-chip"
              }
              aria-pressed={name === category}
              onClick={() => {
                setCategory(name);
                setExpandedId(null);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <h2 className="cc-customer-faq-heading">Common questions</h2>
        <section
          className="cc-profile-faq-list"
          aria-label="Customer frequently asked questions"
        >
          {visible.map((faq) => {
            const isOpen = expandedId === faq.id;
            const panelId = `cc-customer-faq-answer-${faq.id}`;
            return (
              <div className="cc-profile-faq-item" key={faq.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setExpandedId(isOpen ? null : faq.id)}
                >
                  <span className="cc-customer-faq-label-wrap">
                    <span className="cc-customer-faq-category-label">
                      {faq.category}
                    </span>
                    <strong>{faq.question}</strong>
                  </span>
                  <ChevronDown size={19} className={isOpen ? "up" : ""} />
                </button>
                {isOpen && <p id={panelId}>{faq.answer}</p>}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="cc-profile-empty">
              No matching questions. Try a different search or category.
            </p>
          )}
        </section>
        <div className="cc-profile-faq-footer">
          <Headphones size={20} />
          <span>Still need help? Submit a technical support report.</span>
          <Link to="/customer/support">Contact Support</Link>
        </div>
      </main>
    </div>
  );
}
