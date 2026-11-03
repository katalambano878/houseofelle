'use client';

interface FraudDetectionAlertProps {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  /** Shown in the badge; pass the order number when there is one. */
  orderId: string;
  /** Contact details for the "Contact Customer" actions. */
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Cancels the order. There is no on-hold status, so cancel is the only stop action. */
  onCancelOrder?: () => void;
  cancelling?: boolean;
}

/** Real mailbox only: skips POS placeholder addresses like walkin@pos.local. */
function isMailable(email: string | null | undefined): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('.local');
}

export default function FraudDetectionAlert({
  riskLevel,
  reasons,
  orderId,
  contactEmail,
  contactPhone,
  onCancelOrder,
  cancelling = false,
}: FraudDetectionAlertProps) {
  const phone = contactPhone ? contactPhone.replace(/[^\d+]/g, '') : '';
  const email = isMailable(contactEmail) ? contactEmail : null;
  const hasActions = !!(phone || email || onCancelOrder);

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'low': return 'bg-green-50 border-green-200 text-green-800';
      case 'medium': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const getRiskIcon = () => {
    switch (riskLevel) {
      case 'low': return 'ri-shield-check-line text-green-600';
      case 'medium': return 'ri-error-warning-line text-orange-600';
      case 'high': return 'ri-alarm-warning-line text-red-600';
    }
  };

  const getRiskLabel = () => {
    switch (riskLevel) {
      case 'low': return 'Low Risk';
      case 'medium': return 'Medium Risk';
      case 'high': return 'High Risk - Review Required';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getRiskColor()}`}>
      <div className="flex items-start gap-3">
        <i className={`${getRiskIcon()} text-xl flex-shrink-0 mt-0.5`}></i>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Fraud Detection: {getRiskLabel()}</h3>
            <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded">
              Order #{orderId}
            </span>
          </div>
          
          {reasons.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Risk Indicators:</p>
              <ul className="space-y-1">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <i className="ri-arrow-right-s-line flex-shrink-0 mt-0.5"></i>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {riskLevel !== 'low' && hasActions && (
            <div className={`mt-3 pt-3 border-t ${riskLevel === 'high' ? 'border-red-300' : 'border-orange-300'}`}>
              <p className="text-sm font-medium mb-2">Recommended Actions:</p>
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-phone-line mr-1"></i>
                    Call Customer
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Your order ${orderId}`)}`}
                    className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-mail-line mr-1"></i>
                    Email Customer
                  </a>
                )}
                {onCancelOrder && (
                  <button
                    type="button"
                    onClick={onCancelOrder}
                    disabled={cancelling}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-close-circle-line mr-1"></i>
                    {cancelling ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
