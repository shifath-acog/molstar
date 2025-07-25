    import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id || id.length !== 4) {
      return NextResponse.json({ error: "Invalid PDB ID. Must be 4 characters long." }, { status: 400 })
    }

    // Fetch PDB data from RCSB PDB
    const pdbResponse = await fetch(`https://files.rcsb.org/download/${id.toUpperCase()}.pdb`)

    if (!pdbResponse.ok) {
      if (pdbResponse.status === 404) {
        return NextResponse.json({ error: `PDB ID "${id.toUpperCase()}" not found` }, { status: 404 })
      }
      throw new Error(`Failed to fetch PDB data: ${pdbResponse.statusText}`)
    }

    const pdbData = await pdbResponse.text()

    // Return the PDB data as plain text
    return new NextResponse(pdbData, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error("Error fetching PDB data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
