import urllib.request
url = 'https://raw.githubusercontent.com/sii-cl/schemas/master/EnvioBOLETA_v1.1.xsd'
try:
    with urllib.request.urlopen(url) as response:
        html = response.read()
        with open('EnvioBOLETA.xsd', 'wb') as f:
            f.write(html)
        print("Success")
except Exception as e:
    print(e)
