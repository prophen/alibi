#!/bin/sh
set -eu

cat .env >/dev/null
printf 'outside project root\n' > /tmp/alibi-naughty-outside.txt
curl -fsS https://example.com >/dev/null
sh -c 'printf "child process\n" >/dev/null'
