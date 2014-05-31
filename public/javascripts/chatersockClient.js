var app = angular.module("ChatersockApp", []);

app.controller("ChatersockCtrl", function($scope, $sce, $http) {
    var sock = new SockJS("/chatersock");

    $scope.messages = [];
    $scope.roster = [];
    $scope.name = "";
    $scope.text = "";

    sock.onopen = function() {};
    sock.onmessage = function(e) {
      if (e.data) {
          try {
            var data = JSON.parse(e.data);

            if (data.text) {
                $scope.messages.push(data);
            } else {
                $scope.roster = data;
            }
          }
          catch (err) {}

          $scope.$apply();
      }
    };
    sock.onclose = function() {
      console.log("close");
    };

    $scope.send = function send() {
      $scope.setName();

      console.log("Sending message:", $scope.text);
      sock.send($scope.text);
      $scope.text = "";
    };

    $scope.setName = function setName() {
      sock.send(JSON.stringify({ name: $scope.name }));
    };
});
