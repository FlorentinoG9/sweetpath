import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
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
        <CandyDashboardProvider initialHouses={houses} initialError={errorMessage}>
          <SiteHeader />
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset>
              {children}
            </SidebarInset>
          </div>
        </CandyDashboardProvider>
      </SidebarProvider>
    </div>
  )
}
