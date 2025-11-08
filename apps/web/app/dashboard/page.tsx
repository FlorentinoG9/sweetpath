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
    <main className="bg-background">
      {errorMessage ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          {errorMessage}
        </div>
      ) : (
        <CandyMapDashboard initialHouses={houses} />
      )}
    </main>
  )
}
