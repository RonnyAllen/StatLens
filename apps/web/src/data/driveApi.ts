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

  async listWorkbooks(folderId: string, searchQuery?: string): Promise<any[]> {
    let q = `'${folderId}' in parents and mimeType = 'application/json' and name contains '.statlens' and trashed = false`
    if (searchQuery) {
      q += ` and fullText contains '${searchQuery.replace(/'/g, "\\'")}'`
    }
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,modifiedTime,createdTime,appProperties)`)
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

  async updateWorkbookMetadata(fileId: string, properties: Record<string, string | null>): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`
    const response = await this.fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appProperties: properties })
    })
    if (!response.ok) {
      throw new Error("Failed to update workbook metadata")
    }
  }

  async getProfile(folderId: string): Promise<any> {
    const q = `'${folderId}' in parents and name = 'profile.json' and trashed = false`
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`)
    const data = await res.json()
    
    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id
      const contentRes = await this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
      return contentRes.json()
    }
    return null
  }

  async updateProfile(folderId: string, profileData: any): Promise<void> {
    const q = `'${folderId}' in parents and name = 'profile.json' and trashed = false`
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id)`)
    const data = await res.json()

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id
      await this.fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData)
      })
    } else {
      const metadata = { name: "profile.json", parents: [folderId], mimeType: "application/json" }
      const form = new FormData()
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
      form.append("file", new Blob([JSON.stringify(profileData)], { type: "application/json" }))

      await this.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        body: form
      })
    }
  }

  async uploadProfileImage(folderId: string, imageBlob: Blob): Promise<string> {
    const q = `'${folderId}' in parents and name = 'profile_image.png' and trashed = false`
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id)`)
    const data = await res.json()

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id
      const updateRes = await this.fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "image/png" },
        body: imageBlob
      })
      const updateData = await updateRes.json()
      return updateData.id
    } else {
      const metadata = { name: "profile_image.png", parents: [folderId], mimeType: "image/png" }
      const form = new FormData()
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
      form.append("file", imageBlob)

      const createRes = await this.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        body: form
      })
      const createData = await createRes.json()
      return createData.id
    }
  }
  
  async getProfileImage(fileId: string): Promise<string> {
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&_cb=${Date.now()}`, {
      cache: "no-store"
    })
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }
}
