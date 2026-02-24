import AdmZip from 'adm-zip'
import { PDFDocument } from 'pdf-lib'

import { BookFormat } from '@/core/book/types'

export function extractCover(fmt: BookFormat, data: Buffer): string | null {
  if (fmt === BookFormat.EPUB) return extractCoverEpub(data)
  return null
}

/** XML 태그에서 특정 속성 값을 순서 무관하게 추출 */
function attr(tag: string, name: string): string | null {
  // 속성명="값" 또는 속성명='값'
  const m = tag.match(new RegExp(`${name}=["']([^"']+)["']`))
  return m?.[1] ?? null
}

/** ZIP에서 경로를 찾을 때 슬래시/대소문자 차이를 허용 */
function findEntry(zip: AdmZip, rawPath: string): AdmZip.IZipEntry | null {
  // 선행 슬래시 제거
  const path = rawPath.replace(/^\//, '')
  // 1. 정확한 경로
  const exact = zip.getEntry(path)
  if (exact) return exact
  // 2. 모든 엔트리를 소문자로 비교
  const lower = path.toLowerCase()
  for (const e of zip.getEntries()) {
    if (e.entryName.toLowerCase() === lower) return e
  }
  return null
}

/** 기준 경로 기준으로 상대 href 해석 */
function resolvePath(base: string, href: string): string {
  if (href.startsWith('/')) return href.slice(1)
  if (!base) return href
  // URL 쿼리/프래그먼트 제거
  const clean = href.split('?')[0].split('#')[0]
  // 기준 디렉터리 + 상대 경로 결합 후 .. 정리
  const segments = (base + clean).split('/')
  const resolved: string[] = []
  for (const seg of segments) {
    if (seg === '..') resolved.pop()
    else if (seg !== '.') resolved.push(seg)
  }
  return resolved.join('/')
}

function extractCoverEpub(data: Buffer): string | null {
  try {
    const zip = new AdmZip(data)

    // --- container.xml → OPF 경로 ---
    const containerEntry = findEntry(zip, 'META-INF/container.xml')
    if (!containerEntry) return null
    const containerXml = containerEntry.getData().toString('utf-8')
    const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/)
    if (!rootfileMatch) return null

    const opfPath = rootfileMatch[1]
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
    const opfEntry = findEntry(zip, opfPath)
    if (!opfEntry) return null
    const opfXml = opfEntry.getData().toString('utf-8')

    // --- manifest 파싱 (id → href, media-type) ---
    const manifest = new Map<string, { href: string; mediaType: string }>()
    for (const m of opfXml.matchAll(/<item\s[^>]+>/gi)) {
      const tag = m[0]
      const id = attr(tag, 'id')
      const href = attr(tag, 'href')
      const mediaType = attr(tag, 'media-type') ?? ''
      if (id && href) manifest.set(id, { href, mediaType })
    }

    let coverHref: string | null = null

    // 전략 1: <meta name="cover" content="manifest-id"/>
    // [^>]* (zero-or-more) 사용 → name이 첫 번째 속성이어도 매칭 가능
    const metaCoverMatch = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*>/i)
      ?? opfXml.match(/<meta[^>]*content=["'][^"']+["'][^>]*name=["']cover["'][^>]*>/i)
    if (metaCoverMatch) {
      const contentId = attr(metaCoverMatch[0], 'content')
      if (contentId) coverHref = manifest.get(contentId)?.href ?? null
    }

    // 전략 2: properties="cover-image" 속성 포함 item (속성 순서 무관)
    if (!coverHref) {
      for (const m of opfXml.matchAll(/<item[^>]+>/gi)) {
        const tag = m[0]
        if (tag.includes('cover-image')) {
          const href = attr(tag, 'href')
          if (href) { coverHref = href; break }
        }
      }
    }

    // 전략 3: id에 "cover" 포함 + 이미지 media-type
    if (!coverHref) {
      for (const [id, entry] of manifest) {
        if (id.toLowerCase().includes('cover') && entry.mediaType.startsWith('image/')) {
          coverHref = entry.href
          break
        }
      }
    }

    // 전략 4: guide의 type="cover"
    if (!coverHref) {
      const guideMatch = opfXml.match(/<reference[^>]+type=["']cover["'][^>]*>/i)
      if (guideMatch) coverHref = attr(guideMatch[0], 'href')
    }

    // 전략 5: href 파일명에 "cover" 포함 + 이미지 media-type
    if (!coverHref) {
      for (const [, entry] of manifest) {
        const name = entry.href.toLowerCase()
        if (name.includes('cover') && entry.mediaType.startsWith('image/')) {
          coverHref = entry.href
          break
        }
      }
    }

    // 전략 6: spine 첫 번째 itemref 로 가리키는 이미지 item
    if (!coverHref) {
      const firstSpineMatch = opfXml.match(/<itemref[^>]+idref=["']([^"']+)["'][^>]*>/i)
      if (firstSpineMatch) {
        const firstId = firstSpineMatch[1]
        // spine 첫 항목이 직접 이미지면 사용
        const spineEntry = manifest.get(firstId)
        if (spineEntry?.mediaType.startsWith('image/')) {
          coverHref = spineEntry.href
        }
      }
    }

    // 전략 7 (최후 수단): ZIP 내에서 이름 순 첫 번째 이미지 파일
    if (!coverHref) {
      const imageEntries = zip.getEntries()
        .filter(e => /\.(jpe?g|png|gif|webp)$/i.test(e.entryName) && !e.entryName.toLowerCase().includes('meta-inf'))
        .sort((a, b) => a.entryName.localeCompare(b.entryName))
      if (imageEntries.length > 0) {
        const imgData = imageEntries[0].getData()
        let mime = 'jpeg'
        if (imgData[0] === 0x89 && imgData[1] === 0x50) mime = 'png'
        else if (imgData[0] === 0x47 && imgData[1] === 0x49) mime = 'gif'
        else if (imgData[0] === 0x52 && imgData[1] === 0x49) mime = 'webp'
        return `data:image/${mime};base64,${imgData.toString('base64')}`
      }
    }

    if (!coverHref) return null

    // --- HTML 커버 페이지 → img src 추출 ---
    if (/\.x?html?($|\?)/i.test(coverHref)) {
      const htmlFullPath = resolvePath(opfDir, coverHref)
      const htmlEntry = findEntry(zip, htmlFullPath)
      if (htmlEntry) {
        const html = htmlEntry.getData().toString('utf-8')
        const imgMatch = html.match(/<img\s[^>]+>/i)
        if (imgMatch) {
          const src = attr(imgMatch[0], 'src')
          if (src) {
            // HTML 파일 기준 디렉터리 기준으로 상대경로 해석
            const htmlDir = htmlFullPath.includes('/')
              ? htmlFullPath.substring(0, htmlFullPath.lastIndexOf('/') + 1)
              : ''
            coverHref = resolvePath(htmlDir, src)
          }
        }
      }
    } else {
      coverHref = resolvePath(opfDir, coverHref)
    }

    // --- 이미지 엔트리 읽기 ---
    const imgEntry = findEntry(zip, coverHref)
    if (!imgEntry) return null

    const imgData = imgEntry.getData()
    // magic bytes로 mime 판별
    let mime = 'jpeg'
    if (imgData[0] === 0x89 && imgData[1] === 0x50) mime = 'png'
    else if (imgData[0] === 0x47 && imgData[1] === 0x49) mime = 'gif'
    else if (imgData[0] === 0x52 && imgData[1] === 0x49) mime = 'webp'

    return `data:image/${mime};base64,${imgData.toString('base64')}`
  } catch {
    return null
  }
}

export async function extractTitle(
  fmt: BookFormat,
  data: Buffer
): Promise<string | null> {
  if (fmt === BookFormat.EPUB) {
    return extractTitleEpub(data)
  } else if (fmt === BookFormat.PDF) {
    return await extractTitlePdf(data)
  }
  return null
}

function extractTitleEpub(data: Buffer): string | null {
  try {
    const zip = new AdmZip(data)
    const containerEntry = zip.getEntry('META-INF/container.xml')
    if (!containerEntry) return null

    const containerXml = containerEntry.getData().toString('utf-8')
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/)
    if (!rootfileMatch) return null

    const opfPath = rootfileMatch[1]
    const opfEntry = zip.getEntry(opfPath)
    if (!opfEntry) return null

    const opfXml = opfEntry.getData().toString('utf-8')
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    if (titleMatch) {
      return titleMatch[1].trim()
    }

    const fallbackMatch = opfXml.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (fallbackMatch) {
      return fallbackMatch[1].trim()
    }
  } catch {
    return null
  }
  return null
}

async function extractTitlePdf(data: Buffer): Promise<string | null> {
  try {
    const pdfDoc = await PDFDocument.load(data)
    const title = pdfDoc.getTitle()
    if (title) {
      return title.trim()
    }
  } catch {
    return null
  }
  return null
}
