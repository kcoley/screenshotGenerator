import argparse
import json
import os
import shutil


def copyImagesOver(manifest, source_dir, thumbnails_dir):
    target_root_dir = os.path.dirname(manifest)
    total_index = 0
    copied_index = 0

    manifest_data = json.load(open(manifest))
    for folder_model_entry in manifest_data:
        folder_name = folder_model_entry['folder']
        
        figures_dir = os.path.join(
            target_root_dir, folder_name, 'Figures'
        )
        
        target_sample_image_dir = os.path.join(figures_dir, 'SampleImages')
        
        target_thumbnail_image_dir = os.path.join(
            figures_dir, 'Thumbnails'
        )

        for i in range(0, len(folder_model_entry['models'])):
            image_filename = folder_model_entry['models'][i]['fileName'].replace(
                '.gltf', '.png')

            source_image_path = os.path.join(source_dir, image_filename)
            target_image_path = os.path.join(
                target_sample_image_dir, image_filename)

            if os.path.isfile(source_image_path):
                if not os.path.isdir(target_sample_image_dir):
                    os.makedirs(target_sample_image_dir)

                print(source_image_path + ' --> ' + target_image_path + '\n')
                shutil.copy(source_image_path, target_image_path)
                copied_index = copied_index + 1

            source_thumbnail_image_path = os.path.join(
                thumbnails_dir, image_filename)
            target_thumbnail_image_path = os.path.join(
                target_thumbnail_image_dir, image_filename)

            if os.path.isfile(source_thumbnail_image_path):
                if not os.path.isdir(target_thumbnail_image_dir):
                    os.makedirs(target_thumbnail_image_dir)

                print(source_thumbnail_image_path +
                      ' --> ' + target_thumbnail_image_path + '\n')
                shutil.copy(source_thumbnail_image_path, target_thumbnail_image_path)

            total_index = total_index + 1

        print(total_index)
        print(copied_index)


def parseArgs():
    parser = argparse.ArgumentParser(description="Parses args")
    parser.add_argument('--manifest', action="store",
                        dest="manifest", required=True)
    parser.add_argument('--sourceDir', action="store",
                        dest="source_dir", required=True)
    parser.add_argument('--thumbnailsDir', action='store',
                        dest="thumbnails_dir", required=True)

    return parser.parse_args()


def validate_args(args):
    if not os.path.isfile(args.manifest):
        raise IOError('manifest file {manifest} not found'.format(
            manifest=args.manifest))
    if not os.path.isdir(args.source_dir):
        raise IOError('image source directory {source_dir} not found'.format(
            source_dir=args.source_dir))
    if not os.path.isdir(args.thumbnails_dir):
        raise IOError('thumbnails source directory {thumbnails_dir} not found'.format(
            args.thumbnails_dir))


if __name__ == '__main__':
    args = parseArgs()
    validate_args(args)
    copyImagesOver(manifest=args.manifest, source_dir=args.source_dir,
                   thumbnails_dir=args.thumbnails_dir)
