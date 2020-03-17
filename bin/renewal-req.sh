#!/bin/bash

# Renewal Request Generation
# ==========================
# 1. Generate a new Key
# 2. Generate a request with the same subject of the cert
# 3. Generate a signed CMS with the request inside
# 4. Post the request to URL
# 5. Save the receiptId

# Renewal Polling Process
# =======================
# 1. Get the new certificate from the URL
# 2. Verify the new certificate is correct
# 3. Save the new certificate
# 4. Update the config to use the new key and cert

KEY=$1
CERT=$2

