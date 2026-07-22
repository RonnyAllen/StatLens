import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/data/auth"
import { DriveAPI } from "@/data/driveApi"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Camera, Loader2, Save } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import countries from "world-countries"
import Cropper from "react-easy-crop"
import { useTheme } from "@/components/theme-provider"

const HONORIFICS = ["Mr.", "Ms.", "Mrs.", "Mx.", "Dr.", "Prof."]
const POSITIONS = ["Undergraduate Student", "Masters Student", "PhD Student", "Post Doc", "Professor"]
const COMMON_COUNTRIES = countries
  .sort((a, b) => a.name.common.localeCompare(b.name.common))
  .map(c => ({
    label: `${c.flag} ${c.name.common}`,
    value: c.name.common
  }))



function hexToHSL(hex: string, isDark: boolean = false) {
  let r = 0, g = 0, b = 0;
  if (hex.length == 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length == 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  if (isDark) {
    l = 1 - l;
  }
  return `${(h * 360).toFixed(0)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function invertColorIfDark(hex: string, isDark: boolean = false) {
  if (!isDark) return hex;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  } else {
    return hex;
  }
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  l = 1 - l; // Invert lightness
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? "0" + hexStr : hexStr;
  };
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()
  const { theme } = useTheme()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const [folderId, setFolderId] = useState<string | null>(null)
  
  // Profile Data
  const [name, setName] = useState(user?.name || "")
  const [honorific, setHonorific] = useState("")
  const [customHonorific, setCustomHonorific] = useState("")
  const [isCustomHonorificDialogOpen, setIsCustomHonorificDialogOpen] = useState(false)
  
  const [department, setDepartment] = useState("")
  const [institution, setInstitution] = useState("")
  const [position, setPosition] = useState("")
  const [customPosition, setCustomPosition] = useState("")
  const [isCustomPositionDialogOpen, setIsCustomPositionDialogOpen] = useState(false)
  const [country, setCountry] = useState("")
  
  // Theme
  const [accentColor, setAccentColor] = useState("#3b82f6")

  // Image
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageCropUrl, setImageCropUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  useEffect(() => {
    if (!accessToken) {
      navigate("/")
      return
    }

    async function loadProfile() {
      try {
        const drive = new DriveAPI(accessToken!)
        const fId = await drive.findOrCreateStatLensFolder()
        setFolderId(fId)
        
        const profile = await drive.getProfile(fId)
        if (profile) {
          if (profile.name) setName(profile.name)
          if (profile.honorific) setHonorific(profile.honorific)
          if (profile.department) setDepartment(profile.department)
          if (profile.institution) setInstitution(profile.institution)
          if (profile.position) setPosition(profile.position)
          if (profile.country) setCountry(profile.country)
          if (profile.accentColor) {
            setAccentColor(profile.accentColor)
            document.documentElement.style.setProperty('--primary', hexToHSL(profile.accentColor, isDark))
          }
          
          if (profile.imageId) {
            const imgUrl = await drive.getProfileImage(profile.imageId)
            setProfileImageUrl(imgUrl)
          } else {
             // Default to google image
             setProfileImageUrl(user?.picture || null)
          }
        } else {
           setProfileImageUrl(user?.picture || null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadProfile()
  }, [accessToken, navigate, user, isDark])

  const handleSave = async () => {
    if (!folderId || !accessToken) return
    setIsSaving(true)
    try {
      const drive = new DriveAPI(accessToken)
      let imageId = undefined
      
      if (imageFile) {
        imageId = await drive.uploadProfileImage(folderId, imageFile)
      }

      const profileData = {
        name,
        honorific,
        department,
        institution,
        position,
        country,
        accentColor,
        imageId
      }

      await drive.updateProfile(folderId, profileData)
      toast.success("Profile saved successfully!")
      window.dispatchEvent(new CustomEvent('statlens-profile-updated'))
    } catch (e) {
      console.error(e)
      toast.error("Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      setImageCropUrl(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const confirmCrop = async () => {
    if (!imageCropUrl || !croppedAreaPixels) return

    const img = new Image()
    img.src = imageCropUrl
    await new Promise(resolve => { img.onload = resolve })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = croppedAreaPixels.width
    canvas.height = croppedAreaPixels.height
    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    )

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], "profile.png", { type: "image/png" })
        setImageFile(croppedFile)
        setProfileImageUrl(URL.createObjectURL(blob))
        setImageCropUrl(null)
      }
    }, "image/png")
  }

  const handleHonorificSelect = (val: string) => {
    if (val === "Custom") {
      setIsCustomHonorificDialogOpen(true)
    } else {
      setHonorific(val)
    }
  }

  const handlePositionSelect = (val: string) => {
    if (val === "Custom") {
      setIsCustomPositionDialogOpen(true)
    } else {
      setPosition(val)
    }
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-4 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Profile Settings</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Profile Image */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-muted bg-muted flex items-center justify-center">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-muted-foreground">{name?.charAt(0).toUpperCase() || "U"}</span>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-105 transition-transform"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Honorific</Label>
              <SearchableSelect
                value={honorific}
                onChange={handleHonorificSelect}
                options={[...HONORIFICS.map(h => ({label: h, value: h})), {label: "Custom", value: "Custom"}]}
                placeholder="Select honorific..."
              />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Affiliations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position</Label>
                <SearchableSelect
                  value={position}
                  onChange={handlePositionSelect}
                  options={[...POSITIONS.map(p => ({label: p, value: p})), {label: "Custom", value: "Custom"}]}
                  placeholder="Select position..."
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Dept of Biology" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Institution</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Science" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <SearchableSelect
                value={country}
                onChange={(v) => setCountry(v)}
                options={COMMON_COUNTRIES}
                placeholder="Select Country..."
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Accent Color</Label>
              <div className="flex gap-4 items-center">
                <input 
                  type="color" 
                  value={invertColorIfDark(accentColor, isDark)} 
                  onChange={(e) => {
                    const newBaseColor = invertColorIfDark(e.target.value, isDark)
                    setAccentColor(newBaseColor)
                    document.documentElement.style.setProperty('--primary', hexToHSL(newBaseColor, isDark))
                  }}
                  className="w-10 h-10 rounded cursor-pointer p-0 border-0 shadow-sm"
                />
                <span className="text-sm font-mono text-muted-foreground uppercase">{invertColorIfDark(accentColor, isDark)}</span>
                <Button variant="outline" size="sm" onClick={() => {
                  setAccentColor("#3b82f6")
                  document.documentElement.style.setProperty('--primary', hexToHSL("#3b82f6", isDark))
                }}>Reset</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isCustomHonorificDialogOpen} onOpenChange={setIsCustomHonorificDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Custom Honorific</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={customHonorific} 
              onChange={e => setCustomHonorific(e.target.value)} 
              placeholder="e.g. Rev., Sir, etc." 
            />
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setHonorific(customHonorific)
              setIsCustomHonorificDialogOpen(false)
            }}>Set Honorific</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomPositionDialogOpen} onOpenChange={setIsCustomPositionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Custom Position</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={customPosition} 
              onChange={e => setCustomPosition(e.target.value)} 
              placeholder="e.g. Research Assistant" 
            />
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setPosition(customPosition)
              setIsCustomPositionDialogOpen(false)
            }}>Set Position</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cropper Dialog */}
      {imageCropUrl && (
        <Dialog open={!!imageCropUrl} onOpenChange={(val) => !val && setImageCropUrl(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crop Image</DialogTitle>
            </DialogHeader>
            <div className="relative w-full h-64 bg-black/10 rounded overflow-hidden">
              <Cropper
                image={imageCropUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setImageCropUrl(null)} variant="outline">Cancel</Button>
              <Button onClick={confirmCrop}>Crop & Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
