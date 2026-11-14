#!/usr/bin/env perl
use strict;
use warnings;
use Cwd qw(abs_path);
use FindBin;
use Getopt::Long qw(GetOptions);
use IO::Socket::INET;

my $port = 4173;
GetOptions('port=i' => \$port) or die "Verwendung: perl scripts/preview.pl [--port 4173]\n";

my $root = abs_path("$FindBin::Bin/..");
my %files = (
  '/'                       => ['Index.html', 'text/html; charset=utf-8'],
  '/Index.html'             => ['Index.html', 'text/html; charset=utf-8'],
  '/LogbookCore.html'       => ['LogbookCore.html', 'application/javascript; charset=utf-8'],
  '/LocalAppsScriptMock.js' => ['LocalAppsScriptMock.js', 'application/javascript; charset=utf-8'],
);

my $server = IO::Socket::INET->new(
  LocalAddr => '0.0.0.0',
  LocalPort => $port,
  Proto     => 'tcp',
  Listen    => 5,
  ReuseAddr => 1,
) or die "Vorschau konnte nicht auf Port $port gestartet werden: $!\n";

print "Lokale Vorschau: http://127.0.0.1:$port\n";
while (my $client = $server->accept()) {
  my $request = <$client> // '';
  my ($path) = $request =~ m{^[A-Z]+\s+([^\s?]+)};
  $path //= '/';
  while (my $line = <$client>) { last if $line =~ /^\r?\n$/; }

  if (!exists $files{$path}) {
    print $client "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
    close $client;
    next;
  }

  my ($relative_path, $content_type) = @{ $files{$path} };
  my $file = "$root/$relative_path";
  open my $fh, '<:raw', $file or die "Kann $file nicht lesen: $!\n";
  local $/;
  my $body = <$fh>;
  close $fh;

  print $client "HTTP/1.1 200 OK\r\n";
  print $client "Content-Type: $content_type\r\n";
  print $client "Content-Length: " . length($body) . "\r\n";
  print $client "Cache-Control: no-store\r\n\r\n";
  print $client $body;
  close $client;
}
