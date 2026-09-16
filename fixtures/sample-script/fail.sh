#!/bin/sh
printf '%s\n' 'failing script ran'
printf '%s\n' 'failing script wrote to stderr' >&2
exit 3
