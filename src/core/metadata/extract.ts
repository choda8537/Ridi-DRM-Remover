import AdmZip from 'adm-zip'
import { PDFDocument } from 'pdf-lib'

import { BookFormat } from '@/core/book/types'

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
