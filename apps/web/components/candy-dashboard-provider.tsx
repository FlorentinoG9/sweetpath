"use client"

import { parseAsInteger, useQueryState } from "nuqs"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { BannerState } from "@/components/create-house-form"
import type { House, HousePayload } from "@/lib/api"
import { ApiError, createHouse, deleteHouse, updateHouse } from "@/lib/api"
import { getMapStyleUrl } from "@/lib/config"

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

interface CandyDashboardProviderProps {
  readonly initialHouses: House[]
  readonly initialError: string | null
  readonly children: ReactNode
}

interface CandyDashboardContextValue {
  readonly banner: BannerState
  readonly formState: HousePayload
  readonly houses: House[]
  readonly sortedHouses: House[]
  readonly selectedHouseId: number | null
  readonly isSubmitting: boolean
  readonly isDeleting: boolean
  readonly isEditing: boolean
  readonly loadError: string | null
  readonly styleUrl: string
  readonly handleFieldChange: (
    field: keyof HousePayload,
  ) => (value: string | boolean | number) => void
  readonly handleCoordinateInputChange: (
    field: "latitude" | "longitude",
  ) => (value: string) => void
  readonly handleSubmit: () => Promise<void>
  readonly handleDelete: () => Promise<void>
  readonly handleSelectHouse: (houseId: number | null) => void
  readonly handleCoordinateChange: (
    houseId: number,
    latitude: number,
    longitude: number,
  ) => void
  readonly handleCreateNew: () => void
}

const CandyDashboardContext = createContext<CandyDashboardContextValue | undefined>(
  undefined,
)

export function CandyDashboardProvider({
  initialHouses,
  initialError,
  children,
}: CandyDashboardProviderProps) {
  const [houses, setHouses] = useState<House[]>(initialHouses)
  const [banner, setBanner] = useState<BannerState>(null)
  const [formState, setFormState] = useState<HousePayload>({ ...EMPTY_FORM })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadError] = useState<string | null>(initialError)
  const [houseParam, setHouseParam] = useQueryState("house", parseAsInteger)
  const selectedHouseId = houseParam ?? null
  const selectedHouse = useMemo(
    () => houses.find((house) => house.id === selectedHouseId) ?? null,
    [houses, selectedHouseId],
  )
  const styleUrl = useMemo(() => getMapStyleUrl(), [])

  const sortedHouses = useMemo(() => {
    return [...houses].sort((first, second) => {
      const firstDate = first.updated_at ?? first.created_at ?? ""
      const secondDate = second.updated_at ?? second.created_at ?? ""
      return new Date(secondDate).getTime() - new Date(firstDate).getTime()
    })
  }, [houses])

  useEffect(() => {
    if (!selectedHouse) {
      setFormState({ ...EMPTY_FORM })
      return
    }

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
  }, [selectedHouse])

  const handleSelectHouse = useCallback(
    (houseId: number | null) => {
      setBanner(null)
      void setHouseParam(houseId)
    },
    [setHouseParam],
  )

  const handleFieldChange = useCallback(
    (field: keyof HousePayload) => (value: string | boolean | number) => {
      setFormState((previous) => ({
        ...previous,
        [field]: value,
      }))
    },
    [],
  )

  const handleCoordinateInputChange = useCallback(
    (field: "latitude" | "longitude") => (value: string) => {
      setFormState((previous) => ({
        ...previous,
        [field]: value.trim().length === 0 ? null : Number.parseFloat(value),
      }))
    },
    [],
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

  const normalizePayload = useCallback((payload: HousePayload): HousePayload => {
    return {
      ...payload,
      address_line2: normalizeOptional(payload.address_line2),
      treats_description: normalizeOptional(payload.treats_description),
      start_time: normalizeOptional(payload.start_time),
      end_time: normalizeOptional(payload.end_time),
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const missingField = REQUIRED_FIELDS.find((field) => {
      const value = formState[field]
      if (typeof value === "string") {
        return value.trim().length === 0
      }
      return value === undefined
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
        const updatedHouse = await updateHouse(selectedHouse.id, payload)
        setHouses((previous) =>
          previous.map((house) =>
            house.id === updatedHouse.id ? updatedHouse : house,
          ),
        )
        setBanner({ variant: "success", message: "House updated successfully." })
        return
      }

      const createdHouse = await createHouse(payload)
      setHouses((previous) => [...previous, createdHouse])
      await setHouseParam(createdHouse.id)
      setBanner({ variant: "success", message: "House added to the map." })
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `${error.message} (status ${error.status})`
          : "Request failed."
      setBanner({ variant: "error", message })
    } finally {
      setIsSubmitting(false)
    }
  }, [formState, normalizePayload, selectedHouse, setHouseParam])

  const handleDelete = useCallback(async () => {
    if (!selectedHouse) {
      return
    }

    setIsDeleting(true)
    setBanner(null)

    try {
      await deleteHouse(selectedHouse.id)
      setHouses((previous) => previous.filter((house) => house.id !== selectedHouse.id))
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
  }, [selectedHouse, setHouseParam])

  const handleCreateNew = useCallback(() => {
    handleSelectHouse(null)
  }, [handleSelectHouse])

  const contextValue = useMemo<CandyDashboardContextValue>(
    () => ({
      banner,
      formState,
      houses,
      sortedHouses,
      selectedHouseId,
      isSubmitting,
      isDeleting,
      isEditing: selectedHouse !== null,
      loadError,
      styleUrl,
      handleFieldChange,
      handleCoordinateInputChange,
      handleSubmit,
      handleDelete,
      handleSelectHouse,
      handleCoordinateChange,
      handleCreateNew,
    }),
    [
      banner,
      formState,
      houses,
      sortedHouses,
      selectedHouseId,
      isSubmitting,
      isDeleting,
      selectedHouse,
      loadError,
      styleUrl,
      handleFieldChange,
      handleCoordinateInputChange,
      handleSubmit,
      handleDelete,
      handleSelectHouse,
      handleCoordinateChange,
      handleCreateNew,
    ],
  )

  return (
    <CandyDashboardContext.Provider value={contextValue}>
      {children}
    </CandyDashboardContext.Provider>
  )
}

export function useCandyDashboard() {
  const context = useContext(CandyDashboardContext)
  if (!context) {
    throw new Error("useCandyDashboard must be used within a CandyDashboardProvider")
  }
  return context
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


