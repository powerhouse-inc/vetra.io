import { Check, X } from 'lucide-react'

const differentiators = [
  {
    title: 'Open source, all the way down',
    description:
      "Vetra isn't just a tool that generates apps. The platform itself is open source. Inspect it, modify it, run it wherever you like.",
  },
  {
    title: 'No hostage situations',
    description:
      'With most AI builders, your data and logic live on their servers. Leave them and you start over. With Vetra, everything is portable — always.',
  },
  {
    title: 'A workspace, not a generator',
    description:
      "Vetra isn't a one-shot tool. It's the environment your team works in every day — with real-time collaboration, version history, and role-based access built in.",
  },
]

const comparison = [
  { feature: 'Platform is open source (Copyleft)', others: false, vetra: true },
  { feature: 'Self-host everything', others: false, vetra: true },
  { feature: 'Local first & Works offline', others: false, vetra: true },
  { feature: 'Data stays portable', others: false, vetra: true },
  { feature: 'Team collaboration built in', others: false, vetra: true },
  { feature: 'Developer customizable', others: false, vetra: true },
]

export function WhyVetra() {
  return (
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      <div className="mb-12 text-center">
        <h2 className="text-foreground mb-4 text-3xl font-bold">Yours to run. Yours to own.</h2>
        <p className="text-foreground-70 mt-2 text-2xl">
          Most AI builders generate code and host it for you.
          <br />
          Vetra gives you the platform itself.
        </p>
      </div>

      {/* Three differentiator cards */}
      <div className="mb-16 grid gap-6 lg:grid-cols-3">
        {differentiators.map((item) => (
          <div key={item.title} className="border-border rounded-xl border p-6">
            <h3 className="text-foreground mb-3 text-lg font-bold">{item.title}</h3>
            <p className="text-foreground-70 text-sm leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="border-border overflow-hidden rounded-xl border">
        <table className="w-full">
          <thead>
            <tr className="bg-accent/50">
              <th className="text-foreground px-6 py-4 text-left text-sm font-semibold">Feature</th>
              <th className="text-foreground-70 px-6 py-4 text-center text-sm font-semibold">
                Other AI builders
              </th>
              <th className="text-foreground px-6 py-4 text-center text-sm font-semibold">Vetra</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row, i) => (
              <tr key={row.feature} className={i % 2 === 0 ? 'bg-background' : 'bg-accent/20'}>
                <td className="text-foreground px-6 py-3.5 text-sm">{row.feature}</td>
                <td className="px-6 py-3.5 text-center">
                  {row.others ? (
                    <Check className="text-primary mx-auto h-4 w-4" />
                  ) : (
                    <X className="text-foreground-30 mx-auto h-4 w-4" />
                  )}
                </td>
                <td className="px-6 py-3.5 text-center">
                  {row.vetra ? (
                    <Check className="text-primary mx-auto h-4 w-4" />
                  ) : (
                    <X className="text-foreground-30 mx-auto h-4 w-4" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
