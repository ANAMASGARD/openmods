import type { Sandbox } from "@daytona/sdk";

// Installer contains no credentials and never contacts a scan target.
export const securityToolkitInstaller = String.raw`#!/usr/bin/env bash
set -euo pipefail
# Tool installation only. This script never scans a target.
root="$HOME/.local/share/openmods-security"
mkdir -p "$root" "$HOME/.local/bin"
if [ -f "$root/ready-v1" ]; then exit 0; fi
sudo -n env DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nmap curl ca-certificates git perl libnet-ssleay-perl libio-socket-ssl-perl libjson-perl libxml-writer-perl default-jre-headless
cd "$root"
npm install --no-audit --no-fund --save-exact playwright@1.64.1
npx playwright install --with-deps chromium
if [ ! -d nikto ]; then git clone --depth 1 --branch 2.6.0 https://github.com/sullo/nikto.git nikto; fi
if [ ! -d ZAP_2.17.0 ]; then
  curl --fail --location --retry 2 https://github.com/zaproxy/zaproxy/releases/download/v2.17.0/ZAP_2.17.0_Linux.tar.gz -o zap.tar.gz
  echo 'efe799aaa3627db683b43f00c9c210aea0b75c00cc8f0a0f0434d12bb3ddde5a  zap.tar.gz' | sha256sum -c -
  tar -xzf zap.tar.gz
  rm zap.tar.gz
fi
printf '#!/usr/bin/env bash\nexec perl "%s/nikto/program/nikto.pl" "$@"\n' "$root" > "$HOME/.local/bin/nikto"
printf '#!/usr/bin/env bash\nexec "%s/ZAP_2.17.0/zap.sh" -Xmx512m "$@"\n' "$root" > "$HOME/.local/bin/zaproxy"
printf '#!/usr/bin/env bash\nexec node "%s/node_modules/playwright/cli.js" "$@"\n' "$root" > "$HOME/.local/bin/playwright"
chmod +x "$HOME/.local/bin/nikto" "$HOME/.local/bin/zaproxy" "$HOME/.local/bin/playwright"
nmap --version
"$HOME/.local/bin/nikto" -Version
"$HOME/.local/bin/zaproxy" -cmd -version
node -e 'const {chromium}=require("playwright"); (async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setContent("<title>OpenMods browser check</title>");if(await p.title()!=="OpenMods browser check")throw Error("Browser failed");await b.close();console.log("Playwright Chromium launch passed")})().catch(e=>{console.error(e.message);process.exit(1)})'
touch "$root/ready-v1"
`;

export async function installSecurityToolkit(sandbox: Sandbox) {
  await sandbox.fs.uploadFile(Buffer.from(securityToolkitInstaller), "/tmp/openmods-install-security-tools.sh");
  const result = await sandbox.process.executeCommand("bash /tmp/openmods-install-security-tools.sh > /tmp/openmods-security-install.log 2>&1", undefined, undefined, 600);
  if (result.exitCode !== 0) throw new Error("Security toolkit installation failed. Check the sandbox installation log.");
}
