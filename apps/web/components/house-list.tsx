"use client"

import type { House } from "@/lib/api"

interface HouseListProps {
    houses: House[]
    selectedHouseId: number | null
    onSelectHouse: (houseId: number | null) => void
}

export function HouseList({ houses, selectedHouseId, onSelectHouse }: HouseListProps) {
    if (houses.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                No houses have been added yet. Create the first entry to populate the map.
            </p>
        )
    }

    return (
        <ul className="flex flex-col gap-3">
            {houses.map((house) => {
                const isSelected = house.id === selectedHouseId
                return (
                    <li key={house.id}>
                        <button
                            type="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`Select ${house.name}`}
                            onClick={() => onSelectHouse(house.id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    onSelectHouse(house.id)
                                }
                            }}
                            className={`w-full rounded-lg border px-4 py-3 text-left transition ${isSelected
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-card hover:border-primary/60 hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="font-medium leading-tight">{house.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatAddress(house)}
                                    </p>
                                </div>
                                <span
                                    className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${house.is_active
                                        ? "bg-emerald-500/10 text-emerald-600"
                                        : "bg-yellow-500/10 text-yellow-700"
                                        }`}
                                >
                                    {house.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>
                            {house.treats_description ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {house.treats_description}
                                </p>
                            ) : null}
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}

function formatAddress(house: House) {
    const segments = [
        house.address_line1,
        house.address_line2 ?? "",
        `${house.city}, ${house.state} ${house.postal_code}`,
    ]
    return segments.filter(Boolean).join(", ")
}


