import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

export async function optimizeModel(input) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  });
  const document = await io.readBinary(input);
  const materials = document.getRoot().listMaterials().map(material => material.getName());
  // Sidecar tracks address materials by index. Never merge/reorder materials or nodes.
  await document.transform(
    resample({ tolerance: 0, cleanup: false }),
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
  );
  // QUANTIZE is the codec mode, but no quantize transform is run: retain original
  // float values, topology, morph targets and textures without lossy filters.
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const output = await io.writeBinary(document);
  const json = JSON.parse(new TextDecoder().decode(output.subarray(20, 20 + new DataView(output.buffer, output.byteOffset).getUint32(12, true))));
  if (JSON.stringify(json.materials.map(material => material.name ?? '')) !== JSON.stringify(materials)) {
    throw new Error('Model optimization changed material indices used by runtime tracks.');
  }
  return output;
}
