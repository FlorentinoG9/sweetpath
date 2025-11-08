"use client"

import { Button } from "@workspace/ui/components/button"
import { parseAsInteger, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CandyMap } from "@/components/candy-map"
import type { House, HousePayload } from "@/lib/api"
import { ApiError, createHouse, deleteHouse, updateHouse } from "@/lib/api"
import { getMapStyleUrl } from "@/lib/config"

interface CandyMapDashboardProps {
    initialHouses: House[]
}

type BannerState = {
    variant: "success" | "error" | "info"
    message: string
} | null

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
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] lg:items-stretch">
            <div className="lg:h-[calc(100vh-6rem)] lg:min-h-0">
                <CandyMap
                    houses={sortedHouses}
                    selectedHouseId={selectedHouseId}
                    onSelectHouse={handleSelectHouse}
                    onCoordinateChange={handleCoordinateChange}
                    styleUrl={styleUrl}
                />
            </div>

            <div className="flex w-full flex-col gap-6 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">
                                {selectedHouse ? "Update house" : "Add a new house"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Provide an address and we will geocode it automatically.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectHouse(null)}
                            aria-label="Create a new house entry"
                        >
                            Add new
                        </Button>
                    </div>

                    {banner ? (
                        <div
                            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${banner.variant === "error"
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : banner.variant === "success"
                                    ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700"
                                    : "border-primary/30 bg-primary/10 text-primary"
                                }`}
                            role="alert"
                        >
                            {banner.message}
                        </div>
                    ) : null}

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void handleSubmit()
                        }}
                    >
                        <InputField
                            label="House name"
                            name="name"
                            value={formState.name}
                            onChange={handleFieldChange("name")}
                            autoComplete="off"
                            required
                        />
                        <InputField
                            label="Address line 1"
                            name="address_line1"
                            value={formState.address_line1}
                            onChange={handleFieldChange("address_line1")}
                            autoComplete="address-line1"
                            required
                        />
                        <InputField
                            label="Address line 2"
                            name="address_line2"
                            value={formState.address_line2 ?? ""}
                            onChange={handleFieldChange("address_line2")}
                            autoComplete="address-line2"
                        />
                        <div className="grid gap-4 sm:grid-cols-3">
                            <InputField
                                label="City"
                                name="city"
                                value={formState.city}
                                onChange={handleFieldChange("city")}
                                autoComplete="address-level2"
                                required
                            />
                            <InputField
                                label="State"
                                name="state"
                                value={formState.state}
                                onChange={handleFieldChange("state")}
                                autoComplete="address-level1"
                                required
                            />
                            <InputField
                                label="Postal code"
                                name="postal_code"
                                value={formState.postal_code}
                                onChange={handleFieldChange("postal_code")}
                                autoComplete="postal-code"
                                required
                            />
                        </div>
                        <fieldset className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Coordinates
                            </legend>
                            <p className="text-xs text-muted-foreground">
                                Drag the selected map pin or enter coordinates manually to place the marker before saving.
                            </p>
                            <div className="mt-3 flex flex-col gap-3">
                                <CoordinateInput
                                    label="Latitude"
                                    value={formState.latitude}
                                    onChange={handleCoordinateInputChange("latitude")}
                                />
                                <CoordinateInput
                                    label="Longitude"
                                    value={formState.longitude}
                                    onChange={handleCoordinateInputChange("longitude")}
                                />
                            </div>
                        </fieldset>
                        <TextAreaField
                            label="Treats description"
                            name="treats_description"
                            value={formState.treats_description ?? ""}
                            onChange={handleFieldChange("treats_description")}
                            rows={3}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InputField
                                label="Start time"
                                name="start_time"
                                type="time"
                                value={formState.start_time ?? ""}
                                onChange={handleFieldChange("start_time")}
                            />
                            <InputField
                                label="End time"
                                name="end_time"
                                type="time"
                                value={formState.end_time ?? ""}
                                onChange={handleFieldChange("end_time")}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                className="size-4 rounded border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                checked={formState.is_active ?? true}
                                onChange={(event) => handleFieldChange("is_active")(event.target.checked)}
                            />
                            House is active
                        </label>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                aria-busy={isSubmitting}
                            >
                                {selectedHouse ? "Save changes" : "Create house"}
                            </Button>
                            {selectedHouse ? (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => void handleDelete()}
                                    disabled={isDeleting}
                                    aria-busy={isDeleting}
                                >
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                    </form>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
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

interface InputFieldProps {
    label: string
    name: string
    value: string
    onChange: (value: string) => void
    type?: string
    autoComplete?: string
    required?: boolean
    autoFocus?: boolean
}

function InputField({
    label,
    name,
    value,
    onChange,
    type = "text",
    autoComplete,
    required,
}: InputFieldProps) {
    return (
        <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{label}</span>
            <input
                id={name}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                type={type}
                required={required}
                autoComplete={autoComplete}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
        </label>
    )
}

interface TextAreaFieldProps {
    label: string
    name: string
    value: string
    onChange: (value: string) => void
    rows?: number
}

function TextAreaField({ label, name, value, onChange, rows = 3 }: TextAreaFieldProps) {
    return (
        <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{label}</span>
            <textarea
                id={name}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={rows}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
        </label>
    )
}

interface CoordinateInputProps {
    label: string
    value: number | null | undefined
    onChange: (value: string) => void
}

function CoordinateInput({ label, value, onChange }: CoordinateInputProps) {
    return (
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{label}</span>
            <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                value={value ?? ""}
                placeholder="Drag pin"
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
        </label>
    )
}

interface HouseListProps {
    houses: House[]
    selectedHouseId: number | null
    onSelectHouse: (houseId: number | null) => void
}

function HouseList({ houses, selectedHouseId, onSelectHouse }: HouseListProps) {
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

function normalizeOptional(value: string | null | undefined): string | null {
    if (value === undefined) {
        return null
    }
    return value && value.trim().length > 0 ? value : null
}

function formatAddress(house: House) {
    const segments = [
        house.address_line1,
        house.address_line2 ?? "",
        `${house.city}, ${house.state} ${house.postal_code}`,
    ]
    return segments.filter(Boolean).join(", ")
}

function formatFieldLabel(field: keyof HousePayload) {
    return field
        .replace("address_line1", "address line 1")
        .replace("address_line2", "address line 2")
        .replaceAll("_", " ")
}


