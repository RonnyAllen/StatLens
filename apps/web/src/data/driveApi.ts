export class DriveAPI {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async fetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {})
    headers.set("Authorization", `Bearer ${this.token}`)
    
    const response = await window.fetch(url, { ...options, headers })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("AUTH_REQUIRED")
      }
      const errorText = await response.text()
      throw new Error(`Drive API Error: ${response.status} - ${errorText}`)
    }
    return response
  }

  async findOrCreateStatLensFolder(): Promise<string> {
    // 1. Find the folder
    const q = "name = 'StatLens' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`)
    const data = await res.json()

    if (data.files && data.files.length > 0) {
      return data.files[0].id
    }

    // 2. Create if not found
    const createRes = await this.fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "StatLens",
        mimeType: "application/vnd.google-apps.folder"
      })
    })
    const createData = await createRes.json()
    return createData.id
  }

  async listWorkbooks(folderId: string): Promise<any[]> {
    const q = `'${folderId}' in parents and mimeType = 'application/json' and name contains '.statlens' and trashed = false`
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,modifiedTime)`)
    const data = await res.json()
    return data.files || []
  }

  async createWorkbook(folderId: string, name: string, initialData: any): Promise<string> {
    // We create a file with multipart upload to set name, parent, and content in one go
    const metadata = {
      name: `${name}.statlens`,
      parents: [folderId],
      mimeType: "application/json"
    }

    const form = new FormData()
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
    form.append("file", new Blob([JSON.stringify(initialData)], { type: "application/json" }))

    const res = await this.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      body: form
    })
    
    const data = await res.json()
    return data.id
  }

  async readWorkbook(fileId: string): Promise<any> {
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
    return res.json()
  }

  async deleteWorkbook(fileId: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`
    const response = await this.fetch(url, {
      method: "DELETE"
    })
    
    if (!response.ok) {
      throw new Error("Failed to delete workbook")
    }
  }

  async renameWorkbook(fileId: string, newName: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`
    const finalName = newName.endsWith(".statlens") ? newName : `${newName}.statlens`
    
    const response = await this.fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: finalName })
    })

    if (!response.ok) {
      throw new Error("Failed to rename workbook")
    }
  }

  async duplicateWorkbook(fileId: string, newName: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy`
    const finalName = newName.endsWith(".statlens") ? newName : `${newName}.statlens`
    
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: finalName })
    })

    if (!response.ok) {
      throw new Error("Failed to duplicate workbook")
    }
  }

  async updateWorkbook(fileId: string, data: any): Promise<void> {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
    
    // Update the 'updatedAt' field in the root object automatically
    const payload = {
      ...data,
      updatedAt: new Date().toISOString()
    }
    
    const response = await this.fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error("Failed to update workbook")
    }
  }
}
