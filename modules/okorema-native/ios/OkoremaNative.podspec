require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'OkoremaNative'
  s.version        = package['version']
  s.summary        = 'Exact alarms, widgets bridge, and Reminders import for Okorema'
  s.homepage       = 'https://github.com/okorema/okorema'
  s.license        = 'MIT'
  s.author         = 'Okorema'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'EventKit'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
  s.source_files = '**/*.{h,m,swift}'
end
