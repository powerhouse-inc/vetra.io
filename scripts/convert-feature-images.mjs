import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public', 'images', 'home')

const images = [
  { file: 'rapid-application-development.svg', outWidth: 1200 },
  { file: 'collaborative-infrastructure.svg', outWidth: 1200 },
  { file: 'web3-enabled.svg', outWidth: 1200 },
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const { file, outWidth } of images) {
  const svgPath = path.join(publicDir, file)
  const svgContent = fs.readFileSync(svgPath, 'utf8')

  // Parse native dimensions from the SVG viewBox/width
  const viewBoxMatch = svgContent.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
  const widthAttr = svgContent.match(/^<svg[^>]+width="(\d+(?:\.\d+)?)"/)
  const heightAttr = svgContent.match(/^<svg[^>]+height="(\d+(?:\.\d+)?)"/)

  const nativeW = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : parseFloat(widthAttr?.[1] ?? '1200')
  const nativeH = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : parseFloat(heightAttr?.[1] ?? '800')
  const ratio = nativeH / nativeW
  const outHeight = Math.round(outWidth * ratio)

  await page.setViewportSize({ width: outWidth, height: outHeight })

  const fileUrl = `file://${svgPath}`
  await page.goto(fileUrl)
  await page.waitForTimeout(300)

  const outFile = file.replace('.svg', '.png')
  const outPath = path.join(publicDir, outFile)
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: outWidth, height: outHeight } })

  const inSize = (fs.statSync(svgPath).size / 1024 / 1024).toFixed(1)
  const outSize = (fs.statSync(outPath).size / 1024).toFixed(0)
  console.log(`✓ ${file} (${inSize}MB) → ${outFile} (${outSize}KB)`)
}

await browser.close()
