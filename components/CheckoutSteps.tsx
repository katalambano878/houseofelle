interface CheckoutStepsProps {
  currentStep: number;
}

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const steps = [
    { number: 1, title: 'Your details' },
    { number: 2, title: 'Delivery' },
    { number: 3, title: 'Payment' }
  ];

  return (
    <ol aria-label="Checkout progress" className="flex items-center gap-2 sm:gap-3 list-none m-0 p-0">
      {steps.map((step, index) => {
        const done = currentStep > step.number;
        const active = currentStep === step.number;
        return (
          <li key={step.number} className="flex items-center gap-2 sm:gap-3 min-w-0" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex-none w-8 h-8 rounded-full inline-flex items-center justify-center text-[13px] font-semibold tabular-nums transition-colors motion-reduce:transition-none ${
                done || active
                  ? 'bg-[#2B0B12] text-[#F6EDE3]'
                  : 'bg-[#FBF6EF] text-[#6B565B] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)]'
              }`}
            >
              {done ? <i className="ri-check-line text-base" aria-hidden="true"></i> : step.number}
              {done && <span className="sr-only">{step.number}, done</span>}
            </span>
            <span className={`text-[13px] sm:text-sm whitespace-nowrap ${active ? 'font-semibold text-[#1F1115]' : 'sr-only sm:not-sr-only text-[#6B565B]'}`}>
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`w-4 sm:w-10 h-px ${done ? 'bg-[#2B0B12]' : 'bg-[#1F1115]/20'}`}
              ></span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
