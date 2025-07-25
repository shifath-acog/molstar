"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Search } from "lucide-react"
import MolStarWrapper from "@/components/molstar-wrapper"

export default function Home() {
  const [pdbId, setPdbId] = useState("")
  const [pdbData, setPdbData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPdbId, setCurrentPdbId] = useState<string | null>(null)

  const fetchPdbData = async (id: string) => {
    if (!id.trim()) {
      setError("Please enter a valid PDB ID")
      return
    }

    setLoading(true)
    setError(null)
    setPdbData(null)

    try {
      const response = await fetch(`/api/pdb/${id.toLowerCase()}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`PDB ID "${id}" not found. Please check the ID and try again.`)
        }
        throw new Error(`Failed to fetch PDB data: ${response.statusText}`)
      }

      const data = await response.text()
      setPdbData(data)
      setCurrentPdbId(id.toUpperCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching PDB data")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPdbData(pdbId)
  }

  const handleExampleClick = (exampleId: string) => {
    setPdbId(exampleId)
    fetchPdbData(exampleId)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setPdbData(text)
        setCurrentPdbId(file.name)
        setError(null)
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PDB Structure Viewer</h1>
          <p className="text-lg text-gray-600">Enter a PDB ID to visualize protein structures using Mol*</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Structure
            </CardTitle>
            <CardDescription>Enter a 4-character PDB ID (e.g., 1CRN, 3J3Q, 6M0J) or upload a file</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
              <Input
                type="text"
                placeholder="Enter PDB ID (e.g., 1CRN)"
                value={pdbId}
                onChange={(e) => setPdbId(e.target.value.toUpperCase())}
                maxLength={4}
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !pdbId.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Visualize
                  </>
                )}
              </Button>
              <Button asChild variant="outline">
                <label htmlFor="pdb-upload" className="cursor-pointer">
                  Upload PDB
                  <input id="pdb-upload" type="file" accept=".pdb" onChange={handleFileUpload} className="hidden" />
                </label>
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Try examples:</span>
              {["1CRN", "3J3Q", "6M0J", "1BNA", "2HHB"].map((id) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(id)}
                  disabled={loading}
                  className="text-xs"
                >
                  {id}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card className="mb-6">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Fetching PDB data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {pdbData && currentPdbId && (
          <Card>
            <CardHeader>
              <CardTitle>Structure Visualization - {currentPdbId}</CardTitle>
              <CardDescription>Interactive 3D visualization powered by Mol*</CardDescription>
            </CardHeader>
            <CardContent>
              <MolStarWrapper pdbText={pdbData} artifactName={currentPdbId} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
