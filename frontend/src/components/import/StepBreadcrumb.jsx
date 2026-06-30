import './StepBreadcrumb.css';

const STEPS = [
  { id: 'input',   label: 'Input'   },

  { id: 'resolve', label: 'Resolve' },
  { id: 'preview', label: 'Review'  },
  { id: 'report',  label: 'Report'  },
];

export default function StepBreadcrumb({ current, done = [], onJump, onReset }) {
  const doneSet = new Set(done);
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="step-breadcrumb-wrap">
      <nav className="step-breadcrumb" aria-label="Import steps">
        {STEPS.map((step, idx) => {
          const isDone = doneSet.has(step.id);
          const isActive = step.id === current;
          const isClickable = isDone && onJump;
          return (
            <span key={step.id} className="step-breadcrumb__group">
              <button
                type="button"
                onClick={() => isClickable && onJump(step.id)}
                disabled={!isClickable}
                className={`step-pill ${isActive ? 'step-pill--active' : ''} ${isDone ? 'step-pill--done' : ''}`}
              >
                {step.label}
              </button>
              {idx < STEPS.length - 1 && <span className="step-breadcrumb__sep" aria-hidden="true" />}
            </span>
          );
        })}
      </nav>

      {currentIdx > 0 && currentIdx < STEPS.length - 1 && onReset && (
        <button type="button" className="step-breadcrumb__reset" onClick={onReset}>
          Start over
        </button>
      )}
    </div>
  );
}