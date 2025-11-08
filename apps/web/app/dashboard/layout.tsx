import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { CandyDashboardProvider } from "@/components/candy-dashboard-provider"
import { SiteHeader } from "@/components/site-header"
import { fetchHouses, type House } from "@/lib/api"

export const iframeHeight = "800px"

export const description = "A sidebar with a header and a search form."

export default async function Layout({ children }: { children: React.ReactNode }) {
  let houses: House[] = []
  let errorMessage: string | null = null

  try {
    houses = await fetchHouses()
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Unable to load candy house data."
  }

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <Suspense fallback={<DashboardSuspenseFallback />}>
          <CandyDashboardProvider initialHouses={houses} initialError={errorMessage}>
            <div className="flex flex-1">
              <AppSidebar />
              <SidebarInset>
                {children}
              </SidebarInset>
            </div>
          </CandyDashboardProvider>
        </Suspense>
      </SidebarProvider>
    </div>
  )
}

function DashboardSuspenseFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Loading dashboard...</p>
    </div>
  )
}
