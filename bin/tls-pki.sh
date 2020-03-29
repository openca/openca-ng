#!/bin/bash

# Global Variables
OSSL=`type -path openssl`

BE_DIR=conf/backend
FE_DIR=conf/frontend

# ================
# Certificate Data
# ================

# Backend Authentication Infrastructure
# =====================================

# BE Root
BE_ROOT_DIR=$BE_DIR/pki.d/be-root
BE_ROOT_KEY=$BE_ROOT_DIR/be-root-key.pem
BE_ROOT_CERT=$BE_ROOT_DIR/be-root-cert.pem
BE_ROOT_SUBJ="/O=OpenCA/OU=BackEnd Services/CN=Backend Infrastructure Root"
BE_ROOT_DAYS=36500
BE_ROOT_SIZE=8192
BE_ROOT_TYPE=RSA
BE_ROOT_HASH=sha256

# Backend Server
BE_SRV_DIR=$BE_DIR/pki.d/be-server
BE_SRV_KEY=$BE_SRV_DIR/be-server-key.pem
BE_SRV_CERT=$BE_SRV_DIR/be-server-cert.pem
BE_SRV_SUBJ="/O=OpenCA/OU=Backend Services/CN=NG Backend Server 1"
BE_SRV_DAYS=3560
BE_SRV_SIGCERT=$BE_ROOT_CERT
BE_SRV_SIGKEY=$BE_ROOT_KEY
BE_SRV_TYPE=RSA
BE_SRV_SIZE=4096
BE_SRV_HASH=sha384

# # Backend Global Administrator
# BE_GA_DIR=$BE_DIR/pki.d/be-admin
# BE_GA_KEY=$BE_GA_DIR/be-global-admin-key.pem
# BE_GA_CERT=$BE_GA_DIR/be-global-admin-cert.pem
# BE_GA_SUBJ="/O=OpenCA/OU=Backend Services/CN=Backend Global Admin 1"
# BE_GA_DAYS=1825
# BE_GA_SIGCERT=$BE_ROOT_CERT
# BE_GA_SIGKEY=$BE_ROOT_KEY
# BE_GA_TYPE=RSA
# BE_GA_SIZE=4098
# BE_GA_HASH=sha256

# Backend Audit Agent Key
BE_AA_DIR=$BE_DIR/pki.d/be-audit
BE_AA_KEY=$BE_AA_DIR/be-audit-key.pem
BE_AA_CERT=$BE_AA_DIR/be-audit-cert.pem
BE_AA_SUBJ="/O=OpenCA/OU=Backend Audit Services/CN=Audit Agent 1"
BE_AA_DAYS=1825
BE_AA_SIGCERT=$BE_ROOT_CERT
BE_AA_SIGKEY=$BE_ROOT_KEY
BE_AA_TYPE=RSA
BE_AA_SIZE=2048
BE_AA_HASH=sha256

# Frontend Authentication Infrastructure
# ======================================

# FE Root
FE_ROOT_DIR=$FE_DIR/pki.d/fe-root
FE_ROOT_KEY=$FE_ROOT_DIR/fe-root-key.pem
FE_ROOT_CERT=$FE_ROOT_DIR/fe-root-cert.pem
FE_ROOT_SUBJ="/O=OpenCA/OU=BackEnd Services/CN=Frontend Infrastructure Root"
FE_ROOT_DAYS=36500
FE_ROOT_TYPE=ECDSA
FE_ROOT_SIZE=secp521r1
FE_ROOT_HASH=sha512

# Frontend Server
FE_SRV_DIR=$FE_DIR/pki.d/fe-server
FE_SRV_KEY=$FE_SRV_DIR/fe-server-key.pem
FE_SRV_CERT=$FE_SRV_DIR/fe-server-cert.pem
FE_SRV_SUBJ="/O=OpenCA/OU=Frontend Services/CN=NG Frontend Server 1"
FE_SRV_DAYS=1825
FE_SRV_SIGCERT=$FE_ROOT_CERT
FE_SRV_SIGKEY=$FE_ROOT_KEY
FE_SRV_TYPE=RSA
FE_SRV_SIZE=4096
FE_SRV_HASH=sha512

# Backend as Frontend Client
# FE_CLI_DIR=$FE_DIR/pki.d/be-feclient
# FE_CLI_KEY=$FE_CLI_DIR/be-feclient-key.pem
# FE_CLI_CERT=$FE_CLI_DIR/be-feclient-cert.pem
# FE_CLI_SUBJ="/O=OpenCA/OU=Backend Services/CN=NG Backend 1"
# FE_CLI_DAYS=1825
# FE_CLI_SIGCERT=$BE_ROOT_CERT
# FE_CLI_SIGKEY=$BE_ROOT_KEY
# FE_CLI_TYPE=ECDSA
# FE_CLI_SIZE=secp384r1
# FE_CLI_HASH=sha384

# Frontend Backend Audit Agent
FE_AA_DIR=$FE_DIR/pki.d/fe-audit
FE_AA_KEY=$FE_AA_DIR/fe-audit-key.pem
FE_AA_CERT=$FE_AA_DIR/fe-audit-cert.pem
FE_AA_SUBJ="/O=OpenCA/OU=Backend Audit Services/CN=Audit Agent 2"
FE_AA_DAYS=1825
FE_AA_SIGCERT=$BE_ROOT_CERT
FE_AA_SIGKEY=$BE_ROOT_KEY
FE_AA_TYPE=ECDSA
FE_AA_SIZE=secp384r1
FE_AA_HASH=sha384

# Frontend Backend Client
FE_USR_DIR=$FE_DIR/pki.d/fe-user
FE_USR_KEY=$FE_USR_DIR/fe-user-key.pem
FE_USR_CERT=$FE_USR_DIR/fe-user-cert.pem
FE_USR_SUBJ="/O=OpenCA/OU=Frontend Services/CN=Test Client 1"
FE_USR_DAYS=1825
FE_USR_SIGCERT=$FE_ROOT_CERT
FE_USR_SIGKEY=$FE_ROOT_KEY
FE_USR_TYPE=ECDSA
FE_USR_SIZE=secp256r1
FE_USR_HASH=sha256

# ================================
# Certificate Generation Functions
# ================================

function banner_info {
	echo
	echo "OpenCA NG Infrastructure PKI Tool - v0.0.1"
  echo "Copyright (C) 2020 by Massimiliano Pala and OpenCA Labs"
  echo "All Rights Reserved"
  echo
}

function gen_self_signed {

	DIR=${1}
	KEY=${2}
	CRT=${3}
	SUBJ=${4}
	DAYS=${5}
	TYPE=${6}
	SIZE=${7}
	HASH=${8}

	if [ "$DIR" = "" -o "$KEY" = "" -o "$CRT" = "" ] ; then
		echo
		echo "ERROR: Missing argument, aborting."
		echo
		exit 1
	fi

	if ! [ -d "$DIR" ] ; then
		mkdir -p "$DIR"
	fi

	echo "  - Generating Key [ type: $TYPE, strength: $SIZE, file: $KEY ]"

	if [ "$TYPE" = "RSA" ] ; then
		$OSSL genrsa -out "$KEY" "$SIZE" >/dev/null 2>/dev/null
	else
		if [ "$TYPE" = "ECDSA" ] ; then
			$OSSL ecparam -genkey -out "$KEY" -name "$SIZE" >/dev/null 2>/dev/null
		else
			echo
			echo "ERROR: One of RSA or ECDSA must be used, aborting."
			echo
			exit 1;
		fi
	fi

	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the private key for the Infrastructure PKI's Root"
		echo
		exit 1
	fi

	echo "  - Generating Request [ hash: $HASH, key: $KEY, req: $CRT".req" ]"

	$OSSL req -new -$HASH -key "$KEY" -out "$CRT".req -subj "$SUBJ" >/dev/null 2>/dev/null
	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the certificate request for the Infrastructure PKI's Root"
		echo
		exit 1
	fi

	$OSSL x509 -$HASH -req -in "$CRT".req -signkey "$KEY" -out "$CRT" -CAcreateserial -CAserial "$SER" >/dev/null 2>/dev/null
	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the Root Cert for the Infrastructure's PKI"
		echo
		exit 1
	fi
}

function gen_cert {

	DIR=${1}
	KEY=${2}
	CRT=${3}
	SUBJ=${4}
	DAYS=${5}
	CA_CRT=${6}
	CA_KEY=${7}
	TYPE=${8}
	SIZE=${9}
	HASH=${10}

	SER=$DIR/serial

	if [ "$DIR" = "" -o "$KEY" = "" -o "$CRT" = "" ] ; then
		echo
		echo "ERROR: Missing argument, aborting."
		echo
		exit 1
	fi

	if ! [ -d "$DIR" ] ; then
		mkdir -p "$DIR"
	fi

	echo "  - Generating Key [ type: $TYPE, strength: $SIZE, file: $KEY ]"

	if [ "$TYPE" = "RSA" ] ; then
		$OSSL genrsa -out "$KEY" $SIZE >/dev/null 2>/dev/null
	else
		if [ "$TYPE" = "ECDSA" ] ; then
			$OSSL ecparam -genkey -out "$KEY" -name "$SIZE" >/dev/null 2>/dev/null
		else
			echo
			echo "ERROR: One of RSA or ECDSA must be used, aborting."
			echo
			exit 1
		fi
	fi

	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the private key for the Infrastructure PKI Backend"
		echo
		exit 1
	fi

	echo "  - Generating Request [ hash: $HASH, key: $KEY, req: $CRT".req" ]"

	$OSSL req -new -$HASH -key "$KEY" -out "$CRT".req -subj "$SUBJ" >/dev/null 2>/dev/null
	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the certificate request for the Infrastructure PKI's Backend"
		echo
		exit 1
	fi

	$OSSL x509 -req -$HASH -in "$CRT".req -CA "$CA_CRT" -CAkey "$CA_KEY" -out "$CRT" \
		-days "$DAYS" -CAcreateserial -CAserial "$SER" >/dev/null 2>/dev/null
	if [ $? -gt 0 ] ; then
		echo
		echo "ERROR: Cannot generate the Bckend Server Cert for the Infrastructure's PKI"
		echo
		exit 1
	fi
}

# =========
# Main Loop
# =========

# Show some love
banner_info

# Checks the cert to create
case "$1" in

  all)
		# Generates all needed certificates
		$0 root
		$0 backend
		$0 frontend
		;;

  root)
		# Generates the Backend Root CA
		echo "* Generating the Backend Infrastructure RootCA:"
		gen_self_signed "$BE_ROOT_DIR" "$BE_ROOT_KEY" "$BE_ROOT_CERT" "$BE_ROOT_SUBJ" "$BE_ROOT_DAYS" "$BE_ROOT_TYPE" "$BE_ROOT_SIZE" "$BE_ROOT_HASH"
		echo

		# Generates the Front End Root CA
		echo "* Generating the Frontend Infrastructure RootCA:"
		gen_self_signed "$FE_ROOT_DIR" "$FE_ROOT_KEY" "$FE_ROOT_CERT" "$FE_ROOT_SUBJ" "$FE_ROOT_DAYS" "$FE_ROOT_TYPE" "$FE_ROOT_SIZE" "$FE_ROOT_HASH"
		echo
		;;

  backend)

		# Generates the Backend Server Cert
		echo "* Generating the Backend Server's Certificate:"
		gen_cert "$BE_SRV_DIR" "$BE_SRV_KEY" "$BE_SRV_CERT" "$BE_SRV_SUBJ" "$BE_SRV_DAYS" "$BE_SRV_SIGCERT" "$BE_SRV_SIGKEY" "$BE_SRV_TYPE" "$BE_SRV_SIZE" "$BE_SRV_HASH"
		echo

		# echo "Generating the Backend Global Admin's Certificate:"
		# gen_cert "$BE_GA_DIR" "$BE_GA_KEY" "$BE_GA_CERT" "$BE_GA_SUBJ" "$BE_GA_DAYS" "$BE_GA_SIGCERT" "$BE_GA_SIGKEY" "$BE_GA_TYPE" "$BE_GA_SIZE" "$BE_GA_HASH"
		# echo

		# Generates the Backend Audit Authentication Cert
		echo "* Generating the Backend Audit Agent's Certificate:"
		gen_cert "$BE_AA_DIR" "$BE_AA_KEY" "$BE_AA_CERT" "$BE_AA_SUBJ" "$BE_AA_DAYS" "$BE_AA_SIGCERT" "$BE_AA_SIGKEY" "$BE_AA_TYPE" "$BE_AA_SIZE" "$BE_AA_HASH"
		echo

		$0 backend-creds
		;;

	backend-creds)

		# Users Generation
		echo "* Generating Users for the Backend Interface:"

		# Adds a Password-Based test User(s) in the frontend interface
		echo "  - Password-Based User (user1) .....: (passwd) user1"
		tools/gen-user.js -b -u user1 -p user1

		# Adds a Certificate-Based test User(s) in the frontend interface
		# echo "  - Certificate-Based User (user2) .....: (cert) conf/backtend/pki.d/fe-server/fe-server-cert.pem"
		# tools/gen-user.js -b -u user2 -c conf/backend/pki.d/be-server/be-server-cert.pem

		# Adds a User-Based Admin in the frontend interface
		# echo "  - Password-Based Administrator (admin) .....: (passwd) admin"
		# tools/gen-user.js -b -u admin -p admin

		# Adds a User-Based Global Admin in the frontend interface
		echo "  - Password-Based Global Administrator (global) .....: (passwd) global"
		tools/gen-user.js -b -u global -p global -g

		;;

  frontend)
		# Generates the Frontend Server Cert
		echo "* Generating the Frontend Server's Certificate:"
		gen_cert "$FE_SRV_DIR" "$FE_SRV_KEY" "$FE_SRV_CERT" "$FE_SRV_SUBJ" "$FE_SRV_DAYS" "$FE_SRV_SIGCERT" "$FE_SRV_SIGKEY" "$FE_SRV_TYPE" "$FE_SRV_SIZE" "$FE_SRV_HASH"
		echo

		# Generates the Frontend Client (for Backend Communication) Cert
		# echo "* Generating the Frontend Client's Certificate:"
		# gen_cert "$FE_CLI_DIR" "$FE_CLI_KEY" "$FE_CLI_CERT" "$FE_CLI_SUBJ" "$FE_CLI_DAYS" "$FE_CLI_SIGCERT" "$FE_CLI_SIGKEY" "$FE_CLI_TYPE" "$FE_CLI_SIZE" "$FE_CLI_HASH"
		# echo

		# Generates the Frontend Client (for Backend Communication) Cert
		echo "* Generating the Frontend Audit Agent's Certificate:"
		gen_cert "$FE_AA_DIR" "$FE_AA_KEY" "$FE_AA_CERT" "$FE_AA_SUBJ" "$FE_AA_DAYS" "$FE_AA_SIGCERT" "$FE_AA_SIGKEY" "$FE_AA_TYPE" "$FE_AA_SIZE" "$FE_AA_HASH"
		echo

		# Generates a User/Client (for Frontend Communication) Cert
		echo "* Generating the Frontend User Certificate:"
		gen_cert "$FE_USR_DIR" "$FE_USR_KEY" "$FE_USR_CERT" "$FE_USR_SUBJ" "$FE_USR_DAYS" "$FE_USR_SIGCERT" "$FE_USR_SIGKEY" "$FE_USR_TYPE" "$FE_USR_SIZE" "$FE_USR_HASH"
		echo

		$0 frontend-creds

		;;

	frontend-creds)

		# Users Generation
		echo "* Generating Users for the Frontend Interface:"

		# Adds a Password-Based test User(s) in the frontend interface
		echo "  - Password-Based User (test1) .....: (passwd) test1"
		tools/gen-user.js -f -u user1 -p user1

		# Adds a User-Based Admin in the frontend interface
		echo "  - Password-Based Administrator (admin) .....: (passwd) admin"
		tools/gen-user.js -f -u admin -p admin

		# Adds a User-Based Global Admin in the frontend interface
		echo "  - Password-Based Global Administrator (global) .....: (passwd) global"
		tools/gen-user.js -f -u global -p global -g

    # Adds a Certificate-Based test User(s) in the frontend interface
		echo "  - Certificate-Based User (backend1) .....: (cert) conf/backend/pki.d/be-server/be-server-cert.pem"
		tools/gen-user.js -f -u backend1 -c conf/backend/pki.d/be-server/be-server-cert.pem -g
		;;

	cleanup-backend-creds)

		# Removes existing credentials
		rm -rf conf/backend/user.d/*.json conf/backend/user.d/cert.d/*.*

		;;

	cleanup-frontend-creds)

		# Removes existing credentials
		rm -rf conf/frontend/user.d/*.json conf/frontend/user.d/cert.d/*.*

		;;

	cleanup-creds)

		# Cleans-up the Backend Creds First
		$0 cleanup-backend-creds

		# Cleans-up the Frontedn Creds Second
		$0 cleanup-frontend-creds

		;;

  *)
		echo
		echo "    USAGE: Please use one of { root, backend, frontend, global-admin }, aborting."
		echo
		exit 1
		;;

esac

# All Done
echo "All Done"
echo
exit 0


