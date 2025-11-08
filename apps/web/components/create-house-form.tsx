"use client"

import { Button } from "@workspace/ui/components/button"
import type { HousePayload } from "@/lib/api"

export type BannerState = {
    variant: "success" | "error" | "info"
    message: string
} | null

interface CreateHouseFormProps {
    banner: BannerState
    formState: HousePayload
    onFieldChange: (field: keyof HousePayload) => (value: string | boolean | number) => void
    onCoordinateInputChange: (field: "latitude" | "longitude") => (value: string) => void
    onSubmit: () => void | Promise<void>
    onDelete?: () => void | Promise<void>
    onCreateNew: () => void
    isSubmitting: boolean
    isDeleting: boolean
    isEditing: boolean
}

export function CreateHouseForm({
    banner,
    formState,
    onFieldChange,
    onCoordinateInputChange,
    onSubmit,
    onDelete,
    onCreateNew,
    isSubmitting,
    isDeleting,
    isEditing,
}: CreateHouseFormProps) {
    return (
        <div className="border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                        {isEditing ? "Update house" : "Add a new house"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Provide an address and we will geocode it automatically.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onCreateNew}
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
                    void onSubmit()
                }}
            >
                <InputField
                    label="House name"
                    name="name"
                    value={formState.name}
                    onChange={onFieldChange("name")}
                    autoComplete="off"
                    required
                />
                <InputField
                    label="Address line 1"
                    name="address_line1"
                    value={formState.address_line1}
                    onChange={onFieldChange("address_line1")}
                    autoComplete="address-line1"
                    required
                />
                <div className="grid gap-4 sm:grid-cols-3">
                    <InputField
                        label="City"
                        name="city"
                        value={formState.city}
                        onChange={onFieldChange("city")}
                        autoComplete="address-level2"
                        required
                    />
                    <InputField
                        label="State"
                        name="state"
                        value={formState.state}
                        onChange={onFieldChange("state")}
                        autoComplete="address-level1"
                        required
                    />
                    <InputField
                        label="Postal code"
                        name="postal_code"
                        value={formState.postal_code}
                        onChange={onFieldChange("postal_code")}
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
                            onChange={onCoordinateInputChange("latitude")}
                        />
                        <CoordinateInput
                            label="Longitude"
                            value={formState.longitude}
                            onChange={onCoordinateInputChange("longitude")}
                        />
                    </div>
                </fieldset>
                <TextAreaField
                    label="Treats description"
                    name="treats_description"
                    value={formState.treats_description ?? ""}
                    onChange={onFieldChange("treats_description")}
                    rows={3}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                        label="Start time"
                        name="start_time"
                        type="time"
                        value={formState.start_time ?? ""}
                        onChange={onFieldChange("start_time")}
                    />
                    <InputField
                        label="End time"
                        name="end_time"
                        type="time"
                        value={formState.end_time ?? ""}
                        onChange={onFieldChange("end_time")}
                    />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                        type="checkbox"
                        className="size-4 rounded border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        checked={formState.is_active ?? true}
                        onChange={(event) => onFieldChange("is_active")(event.target.checked)}
                    />
                    House is active
                </label>

                <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                    >
                        {isEditing ? "Save changes" : "Create house"}
                    </Button>
                    {isEditing && onDelete ? (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void onDelete()}
                            disabled={isDeleting}
                            aria-busy={isDeleting}
                        >
                            Remove
                        </Button>
                    ) : null}
                </div>
            </form>
        </div>
    )
}

interface InputFieldProps {
    label: string
    name: string
    value: string
    onChange: (value: string | boolean | number) => void
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
    onChange: (value: string | boolean | number) => void
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


