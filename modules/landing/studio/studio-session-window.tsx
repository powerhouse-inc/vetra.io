import { Container } from '../components/section-heading'
import { WindowFrame } from '../components/window-frame'

const PLAN = [
  { done: true, text: 'Add MARK_OVERDUE to the loan model' },
  { done: true, text: 'Processor overdue-check, hourly' },
  { done: true, text: 'Overdue badge in the editor' },
  { done: false, text: 'Write 4 tests' },
]

const DIFF = `+ markOverdue(state, action) {
+   if (state.dueDate < action.timestamp)
+     state.status = "OVERDUE";
+ }`

export function StudioSessionWindow() {
  return (
    <section>
      <Container className="pb-24">
        <WindowFrame
          title="studio · @acme/loans · branch studio/overdue"
          label="A Studio session: the chat, the plan you approved with the code it wrote, and a live preview of the generated loan editor"
        >
          <div className="flex flex-wrap">
            <div className="border-console-line flex min-w-0 flex-[1_1_300px] flex-col gap-3 border-b p-5 text-sm md:border-r md:border-b-0">
              <p className="font-console-mono text-console-faint text-xs">CHAT</p>
              <p className="bg-console-ink text-console-bg max-w-[90%] self-end rounded-xl rounded-br-sm px-3.5 py-2.5 leading-relaxed">
                Loans should turn overdue on their own and notify the borrower.
              </p>
              <p className="bg-console-raised text-console-muted max-w-[92%] rounded-xl rounded-bl-sm px-3.5 py-2.5 leading-relaxed">
                I will add a scheduled processor and a{' '}
                <code className="font-console-mono text-console-ink text-[13px]">MARK_OVERDUE</code>{' '}
                operation. The plan is on the right.
              </p>
            </div>
            <div className="border-console-line flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 border-b p-5 text-sm md:border-r md:border-b-0">
              <p className="font-console-mono text-console-faint text-xs">PLAN · approved by you</p>
              <ul className="flex flex-col gap-2">
                {PLAN.map((p) => (
                  <li key={p.text} className="flex gap-2.5">
                    <span className={p.done ? 'text-console-signal' : 'text-console-warn'}>
                      {p.done ? '✓' : '●'}
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
              <pre className="bg-console-bg font-console-mono text-console-muted m-0 mt-2 overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
                {DIFF}
              </pre>
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-5">
              <p className="font-console-mono text-console-faint text-xs">PREVIEW · loan-editor</p>
              <div className="border-console-line-strong flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[17px] font-semibold">Loan #118</p>
                  <p className="bg-console-warn/15 text-console-warn rounded-full px-2.5 py-1 text-xs">
                    Overdue · 3 days
                  </p>
                </div>
                <p className="text-console-faint text-sm">Borrower</p>
                <p className="-mt-2 text-[15px]">J. Okafor</p>
                <p className="text-console-faint text-sm">Items</p>
                <p className="-mt-2 text-[15px]">ThinkPad X1 · USB-C dock</p>
                <p className="flex flex-wrap gap-2 text-sm">
                  <span className="bg-console-ink text-console-bg rounded-md px-3 py-2">
                    Mark returned
                  </span>
                  <span className="border-console-line-strong rounded-md border px-3 py-2">
                    Extend
                  </span>
                </p>
              </div>
            </div>
          </div>
        </WindowFrame>
      </Container>
    </section>
  )
}
