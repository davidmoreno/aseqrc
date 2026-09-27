# ===========================================================================
#  aseqrc.spec
#
#  Binary only spec: the Go binary is compiled by
#  packaging/scripts/build-rpm.sh inside the target container (so that the
#  Parcel frontend bundle, which the binary embeds, is only built once on the
#  host architecture) and handed over through the pkg_binary define.
#
#  rpmbuild still runs the automatic ELF dependency generator on the result, so
#  the alsa-lib and glibc requirements come out of the binary itself and of the
#  target architecture.
#
#  Defines expected from build-rpm.sh:
#      pkg_version, pkg_release, pkg_binary, src_root, pkg_distro, pkg_arch
# ===========================================================================

%{!?pkg_version: %global pkg_version 0.0.0}
%{!?pkg_release: %global pkg_release 1}
%{!?pkg_binary:  %{error:pkg_binary must be defined (run packaging/Makefile)}}
%{!?src_root:    %{error:src_root must be defined (run packaging/Makefile)}}
%{!?pkg_distro:  %global pkg_distro unknown}
%{!?pkg_arch:    %global pkg_arch %{_arch}}

# No debuginfo: the binary is built with -s -w, and the .build-id symlinks it
# would create are not part of this package.
%global debug_package %{nil}
%global _build_id_links none

Name:           aseqrc
Version:        %{pkg_version}
Release:        %{pkg_release}%{?dist}
Summary:        Control ALSA Sequencer connections via web
License:        @LICENSE@
URL:            https://github.com/davidmoreno/aseqrc/
BuildArch:      %{_arch}

Requires:       alsa-lib
Requires(pre):   shadow-utils
Recommends:     avahi
%{?systemd_requires}

%description
aseqrc runs a small HTTP server that controls the connections of the ALSA
sequencer, so a machine with all the MIDI gear attached (a Raspberry Pi with no
monitor, for example) can be patched from a phone or a tablet.

The web interface is a PWA: it can be installed as an app from the browser.

Built for %{pkg_distro} / %{pkg_arch}.

%prep
# Nothing to unpack: the binary is already compiled.

%build
# Nothing to compile.

%install
rm -rf %{buildroot}
install -D -m 0755 %{pkg_binary} %{buildroot}%{_bindir}/aseqrc
install -D -m 0644 %{src_root}/etc/systemd-aseqrc.service \
    %{buildroot}%{_unitdir}/aseqrc.service
install -D -m 0644 %{src_root}/etc/avahi-aseqrc.service \
    %{buildroot}%{_sysconfdir}/avahi/services/aseqrc.service
install -D -m 0644 %{src_root}/LICENSE %{buildroot}%{_licensedir}/aseqrc/LICENSE
install -D -m 0644 %{src_root}/README.md %{buildroot}%{_docdir}/aseqrc/README.md
install -d -m 0750 %{buildroot}%{_sharedstatedir}/aseqrc

# The account is created before the files are unpacked, and the shared state
# directory is chowned in %post: the files cannot be owned by a user that rpm
# does not know about when it unpacks them (and naming a user in %attr() makes
# rpm generate a Requires: user() that only a sysusers.d file could satisfy).
%pre
getent group aseqrc >/dev/null || groupadd -r aseqrc
if ! getent passwd aseqrc >/dev/null; then
    useradd -r -g aseqrc -d %{_sharedstatedir}/aseqrc -s /sbin/nologin \
        -c "aseqrc daemon" aseqrc
fi
# Access to the ALSA sequencer and the raw MIDI devices.
if getent group audio >/dev/null; then
    usermod -a -G audio aseqrc >/dev/null 2>&1 || :
fi
exit 0

%post
chown aseqrc:aseqrc %{_sharedstatedir}/aseqrc 2>/dev/null || :
chmod 0750 %{_sharedstatedir}/aseqrc 2>/dev/null || :
%systemd_post aseqrc.service

%preun
%systemd_preun aseqrc.service

%postun
%systemd_postun_with_restart aseqrc.service

%files
%{_bindir}/aseqrc
%{_unitdir}/aseqrc.service
%config(noreplace) %{_sysconfdir}/avahi/services/aseqrc.service
%attr(0750,root,root) %dir %{_sharedstatedir}/aseqrc
%license %{_licensedir}/aseqrc/LICENSE
%doc %{_docdir}/aseqrc/README.md

# The changelog is appended by packaging/scripts/build-rpm.sh, so the entries
# always carry the version and the distribution that was actually built.
