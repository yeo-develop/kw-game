import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers
// usage: cutout <in> <out.png>  — 전경(사람·물체)만 남기고 배경 투명
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1])
guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("read fail"); exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(cgImage: cg)
try h.perform([req])
guard let obs = req.results?.first else { print("no foreground"); exit(2) }
let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: h, croppedToInstancesExtent: false)
let ci = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
let out = URL(fileURLWithPath: a[2])
try ctx.writePNGRepresentation(of: ci, to: out, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("ok")
