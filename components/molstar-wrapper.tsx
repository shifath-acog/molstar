"use client"

import { useEffect, useRef } from "react"
import { createPluginUI } from "molstar/lib/mol-plugin-ui"
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18"
import type { PluginUIContext } from "molstar/lib/mol-plugin-ui/context"
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec"
import { StructureSelectionQuery } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query"
import { MolScriptBuilder, MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder"
import {
  MAQualityAssessment,
  QualityAssessmentPLDDTPreset,
} from "molstar/lib/extensions/model-archive/quality-assessment/behavior"
import { PluginSpec } from "molstar/lib/mol-plugin/spec"
import { Color } from "molstar/lib/mol-util/color"
import { PluginCommands } from "molstar/lib/mol-plugin/commands"
import "molstar/build/viewer/molstar.css"
import { Button } from "@/components/ui/button"
import { Download, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

declare global {
  interface Window {
    molstar?: PluginUIContext
  }
}

interface MolStarWrapperProps {
  pdbText: string
  artifactName: string
  args?: {
    chain: string
    residue: number[]
  }[]
}

export function MolStarWrapper({ pdbText, artifactName, args = [] }: MolStarWrapperProps) {
  const parent = useRef<HTMLDivElement>(null)
  const pluginRef = useRef<PluginUIContext | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const container = parent.current
    if (!container || !pdbText || initializedRef.current) return

    initializedRef.current = true
    let pluginInstance: PluginUIContext | null = null

    async function initializeMolstar() {
      try {
        // Create a fresh container div
        const molstarContainer = document.createElement("div")
        molstarContainer.style.width = "100%"
        molstarContainer.style.height = "100%"
        molstarContainer.style.position = "relative"

        if (container) {
          container.innerHTML = ""
          container.appendChild(molstarContainer)
        }

        // Initialize plugin with enhanced settings
        pluginInstance = await createPluginUI({
          target: molstarContainer,
          render: renderReact18,
          spec: {
            ...DefaultPluginUISpec(),
            behaviors: [
              PluginSpec.Behavior(MAQualityAssessment, {
                autoAttach: true,
                showTooltip: true,
              }),
              ...DefaultPluginUISpec().behaviors,
            ],
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                regionState: {
                  top: "full",
                  right: "full",
                  bottom: "full",
                  left: "hidden",
                },
                controlsDisplay: "reactive",
              },
            },
          },
        })

        pluginRef.current = pluginInstance
        window.molstar = pluginInstance

        // Configure plugin interactivity
        pluginInstance.managers.interactivity.setProps({
          granularity: "element",
        })

        // Set canvas background
        if (pluginInstance.canvas3d) {
          PluginCommands.Canvas3D.SetSettings(pluginInstance, {
            settings: {
              renderer: {
                ...pluginInstance.canvas3d.props.renderer,
                backgroundColor: Color.fromHexStyle("#ffffff"),
              },
            },
          })
        }

        // Load structure
        const data = await pluginInstance.builders.data.rawData(
          { data: pdbText, label: `PDB structure - ${artifactName}` },
          { state: { isGhost: true } },
        )

        const trajectory = await pluginInstance.builders.structure.parseTrajectory(data, "pdb")
        const model = await pluginInstance.builders.structure.createModel(trajectory)
        const structure = await pluginInstance.builders.structure.createStructure(model)

        // Create default representation
        await pluginInstance.builders.structure.representation.addRepresentation(structure, {
          type: "cartoon",
          colorTheme: { name: "chain-id" },
        })

        // Apply quality assessment if available
        try {
          await pluginInstance.dataTransaction(async () => {
            await pluginInstance!.managers.structure.component.applyPreset(
              pluginInstance!.managers.structure.hierarchy.current.structures,
              QualityAssessmentPLDDTPreset,
            )
          })
        } catch (qaError) {
          console.log("Quality assessment not available for this structure")
        }

        // Handle residue selection if args provided
        if (args.length > 0) {
          const groups = args.map((chainData) =>
            MS.struct.generator.atomGroups({
              "chain-test": MS.core.rel.eq([
                MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
                chainData.chain,
              ]),
              "residue-test": MS.core.logic.or(
                chainData.residue.map((id) =>
                  MS.core.rel.eq([MolScriptBuilder.struct.atomProperty.macromolecular.auth_seq_id(), id]),
                ),
              ),
            }),
          )

          const query = StructureSelectionQuery(
            "residue_specific_ids_in_multiple_chains",
            MS.struct.combinator.merge(groups),
          )

          await pluginInstance.managers.structure.selection.clear()
          pluginInstance.managers.structure.selection.fromSelectionQuery("set", query)

          const selectedComponent = await pluginInstance.builders.structure.tryCreateComponentFromExpression(
            structure,
            query.expression,
            "selected-residues",
          )

          if (selectedComponent) {
            await pluginInstance.builders.structure.representation.addRepresentation(selectedComponent, {
              type: "molecular-surface",
              colorTheme: { name: "uniform", params: { value: 0x0066cc } },
              sizeTheme: { name: "uniform", params: { value: 1 } },
              alpha: 0.8,
            })
          }
        }

        // Auto-focus on the structure
        PluginCommands.Camera.Reset(pluginInstance)
      } catch (error) {
        console.error("Mol* initialization error:", error)
        if (pluginInstance) {
          pluginInstance.dispose()
        }
        initializedRef.current = false
      }
    }

    initializeMolstar()

    return () => {
      if (pluginRef.current) {
        pluginRef.current.dispose()
        pluginRef.current = null
        window.molstar = undefined
      }
      if (container) {
        container.innerHTML = ""
      }
      initializedRef.current = false
    }
  }, [pdbText, artifactName])

  const handleDownload = () => {
    const blob = new Blob([pdbText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${artifactName}.pdb`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    if (pluginRef.current) {
      PluginCommands.Camera.Reset(pluginRef.current)
    }
  }

  const handleZoomIn = () => {
    if (pluginRef.current?.canvas3d) {
      const { camera } = pluginRef.current.canvas3d
      const newRadius = camera.state.radius * 0.8
      PluginCommands.Camera.Focus(pluginRef.current, {
        center: camera.state.target,
        radius: newRadius,
      })
    }
  }

  const handleZoomOut = () => {
    if (pluginRef.current?.canvas3d) {
      const { camera } = pluginRef.current.canvas3d
      const newRadius = camera.state.radius * 1.2
      PluginCommands.Camera.Focus(pluginRef.current, {
        center: camera.state.target,
        radius: newRadius,
      })
    }
  }

  return (
    <section className="border rounded-xl overflow-hidden bg-white">
      <div
        ref={parent}
        style={{
          width: "100%",
          height: "600px",
          position: "relative",
          overflow: "hidden",
        }}
      />
      <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
        <div className="flex gap-2">
        </div>
        <Button onClick={handleDownload} size="sm">
          <Download className="h-4 w-4 mr-1" />
          Download PDB
        </Button>
      </div>
    </section>
  )
}

export default MolStarWrapper