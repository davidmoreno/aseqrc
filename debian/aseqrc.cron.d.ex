#
# Regular cron jobs for the aseqrc package
#
0 4	* * *	root	[ -x /usr/bin/aseqrc_maintenance ] && /usr/bin/aseqrc_maintenance
