"use client"

import {
  Sidebar,
  SidebarContent,
} from "@workspace/ui/components/sidebar"
import type * as React from "react"
import { useCandyDashboard } from "@/components/candy-dashboard-provider"
import { CreateHouseForm } from "@/components/create-house-form"



export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    banner,
    formState,
    handleFieldChange,
    handleCoordinateInputChange,
    handleSubmit,
    handleDelete,
    handleCreateNew,
    isSubmitting,
    isDeleting,
    isEditing,
    loadError,
  } = useCandyDashboard()

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      style={{ "--sidebar-width": "30rem" } as React.CSSProperties}
      {...props}
    >

      <SidebarContent className="flex flex-col gap-6 p-4">
        {loadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}
        <CreateHouseForm
          banner={banner}
          formState={formState}
          onFieldChange={handleFieldChange}
          onCoordinateInputChange={handleCoordinateInputChange}
          onSubmit={handleSubmit}
          onDelete={isEditing ? handleDelete : undefined}
          onCreateNew={handleCreateNew}
          isSubmitting={isSubmitting}
          isDeleting={isDeleting}
          isEditing={isEditing}
        />
      </SidebarContent>
    </Sidebar>
  )
}
