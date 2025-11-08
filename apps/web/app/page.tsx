import { CandyMapDashboard } from "@/components/candy-map-dashboard"
import type { House } from "@/lib/api"
import { fetchHouses } from "@/lib/api"

export default async function Page() {
  let houses: House[] = []
  let errorMessage: string | null = null

  try {
    houses = await fetchHouses()
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Unable to load candy house data."
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-3 text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Sweetpath
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Find the best candy on your block
          </h1>
          <p className="text-muted-foreground">
            Explore a community-driven map of houses sharing treats. Add your home or update
            details so trick-or-treaters know exactly where to go.
          </p>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            {errorMessage}
          </div>
        ) : (
          <CandyMapDashboard initialHouses={houses} />
        )}
      </div>
    </main>
  )
}
