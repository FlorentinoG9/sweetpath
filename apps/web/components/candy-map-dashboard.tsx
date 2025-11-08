"use client"

import { parseAsInteger, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CandyMap } from "@/components/candy-map"
import { type BannerState, CreateHouseForm } from "@/components/create-house-form"
import { HouseList } from "@/components/house-list"
import type { House, HousePayload } from "@/lib/api"
import { ApiError, createHouse, deleteHouse, updateHouse } from "@/lib/api"
import { getMapStyleUrl } from "@/lib/config"

interface CandyMapDashboardProps {
    initialHouses: House[]
}

const REQUIRED_FIELDS: Array<keyof HousePayload> = [
    "name",
    "address_line1",
    "city",
    "state",
    "postal_code",
]

const EMPTY_FORM: HousePayload = {
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    treats_description: "",
    start_time: "",
    end_time: "",
    is_active: true,
    latitude: null,
    longitude: null,
}

export function CandyMapDashboard({ initialHouses }: CandyMapDashboardProps) {
    const [houses, setHouses] = useState<House[]>(initialHouses)
    const [houseParam, setHouseParam] = useQueryState("house", parseAsInteger)
    const selectedHouseId = houseParam ?? null
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [banner, setBanner] = useState<BannerState>(null)
    const [formState, setFormState] = useState<HousePayload>({ ...EMPTY_FORM })
    const styleUrl = useMemo(() => getMapStyleUrl(), [])

    const selectedHouse = useMemo(
        () => houses.find((house) => house.id === selectedHouseId) ?? null,
        [houses, selectedHouseId],
    )

    const sortedHouses = useMemo(() => {
        return [...houses].sort((a, b) => {
            const aDate = a.updated_at ?? a.created_at ?? ""
            const bDate = b.updated_at ?? b.created_at ?? ""
            return new Date(bDate).getTime() - new Date(aDate).getTime()
        })
    }, [houses])

    useEffect(() => {
        if (selectedHouse) {
            setFormState({
                name: selectedHouse.name,
                address_line1: selectedHouse.address_line1,
                address_line2: selectedHouse.address_line2 ?? "",
                city: selectedHouse.city,
                state: selectedHouse.state,
                postal_code: selectedHouse.postal_code,
                treats_description: selectedHouse.treats_description ?? "",
                start_time: selectedHouse.start_time ?? "",
                end_time: selectedHouse.end_time ?? "",
                is_active: selectedHouse.is_active,
                latitude: selectedHouse.latitude ?? null,
                longitude: selectedHouse.longitude ?? null,
            })
        } else {
            setFormState({ ...EMPTY_FORM })
        }
    }, [selectedHouse])

    const handleSelectHouse = useCallback(
        (houseId: number | null) => {
            setBanner(null)
            void setHouseParam(houseId)
        },
        [setHouseParam],
    )

    const handleCoordinateChange = useCallback(
        (houseId: number, latitude: number, longitude: number) => {
            setFormState((previous) => {
                if (houseId !== selectedHouseId) {
                    return previous
                }
                return {
                    ...previous,
                    latitude,
                    longitude,
                }
            })

            setHouses((previous) =>
                previous.map((house) =>
                    house.id === houseId
                        ? {
                            ...house,
                            latitude,
                            longitude,
                        }
                        : house,
                ),
            )
        },
        [selectedHouseId],
    )

    const handleFieldChange = (field: keyof HousePayload) => (value: string | boolean | number) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleCoordinateInputChange =
        (field: "latitude" | "longitude") =>
            (value: string) => {
                setFormState((previous) => ({
                    ...previous,
                    [field]: value.trim().length === 0 ? null : Number.parseFloat(value),
                }))
            }

    const normalizePayload = (payload: HousePayload): HousePayload => ({
        ...payload,
        address_line2: normalizeOptional(payload.address_line2),
        treats_description: normalizeOptional(payload.treats_description),
        start_time: normalizeOptional(payload.start_time),
        end_time: normalizeOptional(payload.end_time),
    })

    const handleSubmit = async () => {
        const missingField = REQUIRED_FIELDS.find((field) => {
            const value = formState[field]
            return typeof value === "string" ? value.trim().length === 0 : value === undefined
        })

        if (missingField) {
            setBanner({
                variant: "error",
                message: `Please complete the ${formatFieldLabel(missingField)} field.`,
            })
            return
        }

        setIsSubmitting(true)
        setBanner(null)

        const payload = normalizePayload(formState)

        try {
            if (selectedHouse) {
                const updated = await updateHouse(selectedHouse.id, payload)
                setHouses((prev) =>
                    prev.map((house) => (house.id === updated.id ? updated : house)),
                )
                setBanner({ variant: "success", message: "House updated successfully." })
            } else {
                const created = await createHouse(payload)
                setHouses((prev) => [...prev, created])
                await setHouseParam(created.id)
                setBanner({ variant: "success", message: "House added to the map." })
            }
        } catch (error) {
            const message =
                error instanceof ApiError ? `${error.message} (status ${error.status})` : "Request failed."
            setBanner({ variant: "error", message })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedHouse) {
            return
        }
        setIsDeleting(true)
        setBanner(null)

        try {
            await deleteHouse(selectedHouse.id)
            setHouses((prev) => prev.filter((house) => house.id !== selectedHouse.id))
            setBanner({
                variant: "success",
                message: `${selectedHouse.name} removed from the map.`,
            })
            await setHouseParam(null)
        } catch (error) {
            const message =
                error instanceof ApiError ? `${error.message} (status ${error.status})` : "Delete failed."
            setBanner({ variant: "error", message })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] lg:items-stretch">
            <div className="lg:h-[calc(100svh-var(--header-height))] lg:min-h-0">
                <CandyMap
                    houses={sortedHouses}
                    selectedHouseId={selectedHouseId}
                    onSelectHouse={handleSelectHouse}
                    onCoordinateChange={handleCoordinateChange}
                    styleUrl={styleUrl}
                />
            </div>

            <div className="flex w-full flex-col lg:h-[calc(100svh-var(--header-height))] lg:overflow-y-auto">
                <CreateHouseForm
                    banner={banner}
                    formState={formState}
                    onFieldChange={handleFieldChange}
                    onCoordinateInputChange={handleCoordinateInputChange}
                    onSubmit={handleSubmit}
                    onDelete={selectedHouse ? handleDelete : undefined}
                    onCreateNew={() => handleSelectHouse(null)}
                    isSubmitting={isSubmitting}
                    isDeleting={isDeleting}
                    isEditing={selectedHouse !== null}
                />

                <div className="border border-t-0 border-border bg-card p-5 shadow-sm">
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

function normalizeOptional(value: string | null | undefined): string | null {
    if (value === undefined) {
        return null
    }
    return value && value.trim().length > 0 ? value : null
}

function formatFieldLabel(field: keyof HousePayload) {
    return field
        .replace("address_line1", "address line 1")
        .replace("address_line2", "address line 2")
        .replaceAll("_", " ")
}


