"use client"

import { CandyMap } from "@/components/candy-map"
import { useCandyDashboard } from "@/components/candy-dashboard-provider"
import { HouseList } from "@/components/house-list"

export function CandyMapDashboard() {
  const {
    sortedHouses,
    selectedHouseId,
    handleSelectHouse,
    handleCoordinateChange,
    styleUrl,
    loadError,
  } = useCandyDashboard()

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] lg:items-stretch">
      <div className="lg:h-[calc(100svh-var(--header-height))] lg:min-h-0">
        {loadError ? (
          <div className="m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            {loadError}
          </div>
        ) : (
          <CandyMap
            houses={sortedHouses}
            selectedHouseId={selectedHouseId}
            onSelectHouse={handleSelectHouse}
            onCoordinateChange={handleCoordinateChange}
            styleUrl={styleUrl}
          />
        )}
      </div>

      <div className="flex w-full flex-col lg:h-[calc(100svh-var(--header-height))] lg:overflow-y-auto">
        <div className="border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Houses</h2>
            <span className="text-sm text-muted-foreground">{sortedHouses.length} total</span>
          </div>
          <HouseList
            houses={sortedHouses}
            selectedHouseId={selectedHouseId}
            onSelectHouse={handleSelectHouse}
          />
        </div>
      </div>
    </div>
  )
}

