import { useMemo, useState } from 'react';
import {
  Search,
  ChevronDown,
  CircleHelp,
  User,
  ShieldCheck,
  Package,
  CalendarDays,
  CreditCard,
  MessageSquare,
  RefreshCw,
  CalendarX,
  Crown,
  LockKeyhole,
} from 'lucide-react';
import './CatererFAQ.css';
import { Link } from 'react-router-dom';
import CatererPageHeader from '../../components/CatererPageHeader';

type FAQ = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

const CATERER_FAQS: FAQ[] = [
  {
    id: 'booking-requests',
    category: 'Bookings',
    question: 'How do I manage booking requests?',
    answer:
      'Open Bookings to review event details, requested packages, and customer requirements. Accept or reject requests according to your availability.',
  },
  {
    id: 'package-management',
    category: 'Packages & Menu',
    question: 'How do I create or edit a catering package?',
    answer:
      'Open Packages to add or update package pricing, guest capacity, inclusions, and other package information.',
  },
  {
    id: 'menu-management',
    category: 'Packages & Menu',
    question: 'How do I update my food menu?',
    answer:
      'Open Menu to add, edit, or manage food items and their prices.',
  },
  {
    id: 'payment-status',
    category: 'Payments',
    question: 'How can I check whether a customer paid the downpayment?',
    answer:
      'Open the booking details and check its payment status. A successful payment is reflected after verification through the payment system.',
  },
  {
    id: 'customer-cancellation',
    category: 'Cancellations',
    question: 'What happens if the customer cancels a booking?',
    answer:
      'The customer can cancel according to the booking rules. If a verified downpayment was paid, the refund percentage is based on the days remaining before the event.',
  },
  {
    id: 'customer-refund',
    category: 'Refunds',
    question: 'How much must I refund when a customer cancels?',
    answer:
      'For customer-initiated cancellations, refund the verified downpayment as follows: 30 days or more before the event: 100%; 15–29 days: 75%; 8–14 days: 50%; exactly 7 days: 25%; fewer than 7 days: 0%. A 24-hour grace period after payment verification gives a 100% refund if at least 7 calendar days remain before the event.',
  },
  {
    id: 'customer-grace-period',
    category: 'Refunds',
    question: 'How does the 24-hour grace period affect a customer cancellation?',
    answer:
      'A customer cancelling within 24 hours after downpayment verification receives a 100% refund of the verified downpayment if at least 7 calendar days remain before the event. The 24 hours start at payment verification. Fewer than 7 days before the event means no refund, even during the grace period.',
  },
  {
    id: 'caterer-cancellation',
    category: 'Refunds',
    question: 'What if I cancel a customer booking?',
    answer:
      'If you cancel a booking after the customer paid a verified downpayment, you must refund 100% of that downpayment, regardless of the number of days before the event.',
  },
  {
    id: 'refund-process',
    category: 'Refunds',
    question: 'How do I process a refund?',
    answer:
      'Process an eligible refund within 3 days (72 hours) of cancellation. Send the money to the customer and submit the transfer reference and proof. The customer confirms receipt. Either party can flag a problem for Platform Staff to investigate; staff do not send the refund.',
  },
  {
    id: 'subscription',
    category: 'Subscriptions',
    question: 'How do I manage my subscription?',
    answer:
      'Open your Business Profile and Subscription section to review available plans and package or booking limits.',
  },
  {
    id: 'verification',
    category: 'Verification',
    question: 'How do I get my catering business verified?',
    answer:
      'Complete your business profile and submit the required verification documents for Platform Staff review.',
  },
  {
    id: 'complaints',
    category: 'Support',
    question: 'How can I report a problem with a customer?',
    answer:
      'Use Complaints to submit details of the issue so Platform Staff can review it.',
  },

  // ACCOUNT & SECURITY
  {
    id: 'account-appeal',
    category: 'Account & Security',
    question: 'How can I appeal a suspended account?',
    answer:
      'If your account has been suspended, log in to CaterConnect and follow the appeal instructions displayed on the suspension notice. Explain why you believe the suspension should be reviewed and submit your appeal to Platform Staff. If your appeal is rejected, you can review the explanation, edit your appeal, and resubmit it. If Platform Staff approves your appeal, it will be forwarded to the System Administrator for the final account reinstatement process.',
  },
  {
    id: 'forgot-password',
    category: 'Account & Security',
    question: 'What should I do if I forget my password?',
    answer:
      'On the login screen, select Forgot Password and enter the email address registered to your CaterConnect account. Follow the password reset instructions sent to your email.',
  },
  {
    id: 'reset-password',
    category: 'Account & Security',
    question: 'How can I reset my password?',
    answer:
      'If you cannot log in, select Forgot Password on the login screen and enter your registered email address. Follow the instructions sent to your email to create a new password. If you can still access your account, use the password-changing option in your account settings if available.',
  },
  {
    id: 'account',
    category: 'Account',
    question: 'How do I update my business information?',
    answer:
      'Open Business Profile and choose Edit Profile to update your available business and contact information.',
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Bookings: CalendarDays,
  'Packages & Menu': Package,
  Payments: CreditCard,
  Cancellations: CalendarX,
  Refunds: RefreshCw,
  Subscriptions: Crown,
  Verification: ShieldCheck,
  Support: MessageSquare,
  'Account & Security': LockKeyhole,
  Account: User,
};

const REFUND_RULES = [
  { period: '30 days or more', refund: '100%' },
  { period: '15–29 days', refund: '75%' },
  { period: '8–14 days', refund: '50%' },
  { period: 'Exactly 7 days', refund: '25%' },
  { period: 'Fewer than 7 days', refund: '0%' },
];

export default function CatererFAQ() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(
    () => ['All', ...new Set(CATERER_FAQS.map((faq) => faq.category))],
    []
  );

  const filteredFAQs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return CATERER_FAQS.filter((faq) => {
      const matchesCategory =
        category === 'All' || faq.category === category;

      const matchesSearch =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setExpandedId(null);
  };

  return (
    <div className="caterer-faq-page">
      <CatererPageHeader
        icon={<CircleHelp size={25} />}
        title="Frequently Asked Questions"
        description="Find helpful answers about managing your catering business on CaterConnect."
      />

      {/* INTRODUCTION */}
      <div className="caterer-faq-intro">
        <div className="caterer-faq-intro-icon">
          <CircleHelp size={25} />
        </div>

        <div className="caterer-faq-intro-text">
          <h2>How can we help?</h2>
          <p>
            Find answers to common questions about your CaterConnect
            account and services.
          </p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="caterer-faq-search">
        <Search size={19} />
        <input
          type="text"
          placeholder="Search questions or keywords..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setExpandedId(null);
          }}
          aria-label="Search frequently asked questions"
        />
      </div>

      {/* CATEGORY FILTERS */}
      <div className="caterer-faq-category-section">
        <div className="caterer-faq-category-label">
          <span>Browse by category</span>
          <span>{filteredFAQs.length} questions</span>
        </div>

        <div className="caterer-faq-categories">
          {categories.map((item) => (
            <button
              key={item}
              className={`caterer-faq-chip ${
                category === item ? 'active' : ''
              }`}
              onClick={() => {
                setCategory(item);
                setExpandedId(null);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* REFUND POLICY */}
      {(category === 'All' || category === 'Refunds') &&
        !search.trim() && (
          <section className="caterer-faq-policy">
            <div className="caterer-faq-policy-heading">
              <div className="caterer-faq-policy-icon">
                <RefreshCw size={19} />
              </div>
              <div>
                <h2>Customer Cancellation Refund Policy</h2>
                <p>
                  Refund percentages are based on the verified downpayment.
                </p>
              </div>
            </div>

            <div className="caterer-faq-refund-table">
              {REFUND_RULES.map((rule) => (
                <div className="caterer-faq-refund-row" key={rule.period}>
                  <span>{rule.period}</span>
                  <strong>{rule.refund}</strong>
                </div>
              ))}
            </div>

            <div className="caterer-faq-grace-note">
              <strong>24-hour grace period</strong>
              <p>
                A customer who cancels within 24 hours after downpayment
                verification receives a 100% refund if at least 7 calendar
                days remain before the event. The grace period starts at
                payment verification.
              </p>
            </div>

            <div className="caterer-faq-cancellation-note">
              <strong>Caterer-initiated cancellation</strong>
              <p>
                If you cancel a booking after the customer has paid a
                verified downpayment, you must refund 100% of that
                downpayment.
              </p>
            </div>
          </section>
        )}

      {/* FAQ LIST */}
      <div className="caterer-faq-results">
        <div className="caterer-faq-results-heading">
          <h2>Common Questions</h2>
          <span>{filteredFAQs.length} results</span>
        </div>

        {filteredFAQs.length === 0 ? (
          <div className="caterer-faq-empty">
            <Search size={30} />
            <h3>No matching questions</h3>
            <p>
              Try another keyword or select a different category.
            </p>
            <button onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : (
          filteredFAQs.map((faq) => {
            const expanded = expandedId === faq.id;
            const CategoryIcon =
              CATEGORY_ICONS[faq.category] || CircleHelp;

            return (
              <div
                className={`caterer-faq-card ${
                  expanded ? 'expanded' : ''
                }`}
                key={faq.id}
              >
                <button
                  className="caterer-faq-question"
                  onClick={() =>
                    setExpandedId(expanded ? null : faq.id)
                  }
                  aria-expanded={expanded}
                >
                  <div className="caterer-faq-question-content">
                    <span className="caterer-faq-question-category">
                      <CategoryIcon size={13} />
                      {faq.category}
                    </span>

                    <span className="caterer-faq-question-text">
                      {faq.question}
                    </span>
                  </div>

                  <span className="caterer-faq-chevron">
                    <ChevronDown
                      size={19}
                      className={expanded ? 'rotated' : ''}
                    />
                  </span>
                </button>

                {expanded && (
                  <div className="caterer-faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SUPPORT FOOTER */}
      <div className="caterer-faq-contact">
        <div className="caterer-faq-contact-icon">
          <MessageSquare size={22} />
        </div>

        <div className="caterer-faq-contact-text">
          <h3>Still need help?</h3>
          <p>
            If you cannot find the answer, contact our support team
            for assistance.
          </p>
        </div>
<Link to="/caterer/complaints">
  Contact Technical Support
</Link>
      </div>
    </div>
  );
}
