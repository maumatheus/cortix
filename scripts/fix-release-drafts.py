# Junta os rascunhos duplicados que o electron-builder cria na mesma tag e publica a release.
# Uso (dentro do repo): python scripts/fix-release-drafts.py <GH_TOKEN> [vX.Y.Z]
import json, sys, urllib.request, os

tok = sys.argv[1]
TAG = sys.argv[2] if len(sys.argv) > 2 else "v" + json.load(open("package.json", encoding="utf8"))["version"]
API = "https://api.github.com/repos/maumatheus/cortix/releases"
H = {"Authorization": "token " + tok, "Accept": "application/vnd.github+json"}

def req(url, method="GET", data=None, headers=None):
    h = dict(H)
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r) as resp:
        body = resp.read()
        return json.loads(body) if body else None

rels = [r for r in req(API + "?per_page=10") if r["tag_name"] == TAG]
for r in rels:
    print(r["id"], "draft=", r["draft"], [a["name"] for a in r["assets"]])

main = max(rels, key=lambda r: any(a["name"].endswith(".exe") for a in r["assets"]))
names = {a["name"] for a in main["assets"]}
for other in rels:
    if other["id"] == main["id"]:
        continue
    for a in other["assets"]:
        if a["name"] in names:
            continue
        path = os.path.join("dist", a["name"])  # rodar da raiz do repo
        data = open(path, "rb").read()
        req(f"https://uploads.github.com/repos/maumatheus/cortix/releases/{main['id']}/assets?name={a['name']}", "POST", data, {"Content-Type": "application/octet-stream"})
        print("movido", a["name"])
    req(f"{API}/{other['id']}", "DELETE")
    print("apagado draft", other["id"])

# notas da release: env RELEASE_NOTES; sem ela mantém o texto que já estiver na release
body = os.environ.get("RELEASE_NOTES") or main.get("body") or ""
r = req(f"{API}/{main['id']}", "PATCH", json.dumps({"draft": False, "name": TAG, "tag_name": TAG, "body": body}).encode(), {"Content-Type": "application/json"})
print(r["tag_name"], "draft=", r["draft"], sorted(a["name"] for a in r["assets"]))
print("latest =", req(API + "/latest")["tag_name"])
