key="$KEY"
version="$VERSION"

path="./release/rottenbox"

rm -rf ./release;

bun run build;

mkdir -p ./release
cp ./ui/dist/rottenbox.js "$path-$version.js"

# CHROME
path_chrome="$path-$version.chrome"
mv ./addon/release/chrome.zip "$path_chrome.zip"

mkdir -p "$path_chrome"
unzip "$path_chrome.zip" -d "$path_chrome"
bunx crx3 pack "$path_chrome" -p "$key" -o "$path_chrome.crx"
rm -rf "$path_chrome"
