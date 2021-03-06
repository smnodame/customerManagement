var app = angular.module("app", ["ngRoute", "angular-file-input"])
app.config(function($routeProvider, $httpProvider) {

    $httpProvider.interceptors.push(['$q', '$location', function ($q, $location) {
        return {
            'request': function (config) {
                config.headers = config.headers || {};
                if (localStorage.token) {
                    config.headers['x-access-token'] = localStorage.token
                }
                return config
            },
            'responseError': function (response) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.clear()
                    location.href = '/#!/'
                }
                return $q.reject(response)
            }
        }
    }])

    $routeProvider
    .when("/", {
        templateUrl : "api/static/html/customers.html",
        controller: 'customersCtrl'
    })
    .when("/customer/create", {
        templateUrl : "api/static/html/home.html",
        controller: 'createCustomerInfoCtrl'
    })
    .when("/customer", {
        templateUrl : "api/static/html/customers.html",
        controller: 'customersCtrl'
    })
    .when("/customer/:id/edit", {
        templateUrl: "api/static/html/customerEdit.html",
        controller: 'editCustomerInfoCtrl'
    })
    .when("/customer/:id", {
        templateUrl : "api/static/html/customerInfo.html",
        controller: 'customerInfoCtrl'
    })
    .when("/user", {
        templateUrl : 'api/static/html/user.html',
        controller: 'userCtrl'
    })
    .when("/user/create", {
        templateUrl : 'api/static/html/userCreate.html',
        controller: 'userCreateCtrl'
    })
    .when("/user/:id/edit", {
        templateUrl : 'api/static/html/userCreate.html',
        controller: 'userEditCtrl'
    })
    .otherwise({redirectTo : '/'})
})

function validatePassword(p) {
    errors = [];
    if (p.length < 8) {
        errors.push("- Password ต้องประกอบไปด้วยอักษรอย่างน้อย 8 ตัว"); 
    }
    if (p.search(/[a-z]/) < 0) {
        errors.push("- Password ต้องประกอบไปด้วยตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว");
    }
    if (p.search(/[A-Z]/) < 0) {
        errors.push("- Password ต้องประกอบไปด้วยตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว");
    }
    if (p.search(/[0-9]/) < 0) {
        errors.push("- Password ต้องประกอบไปด้วยตัวเลขอย่างน้อย 1 ตัว"); 
    }
    if (p.search(/[!@#$%^&*._]/) < 0) { 
        errors.push("- Password ต้องประกอบไปด้วย Special charactor (!@#$%^&*._) 1 ตัว"); 
    }
    if (errors.length > 0) {
        
        return {
            correct: false,
            message: errors.join("<br/>")
        }
    }
    return {
        correct: true,
        message: ''
    }
}

app.controller('mainCtrl', ['$scope', '$timeout', '$route', ($scope, $timeout, $route) => {
    
    $timeout(() => { 
        const token = localStorage.getItem("token")
        if(token) {
            $scope.token = token
            $scope.account = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : {}
            $scope.is_superuser = $scope.account.account_position == 'admin'
            $scope.page = "content"

            const blockCtrl = ['userCtrl', 'userCreateCtrl']

            $scope.$on('$routeChangeStart', function (event, next, prev) {
                if(!$scope.is_superuser) {
                    if(blockCtrl.find((c) => c == next['$$route'].controller)) {
                        $scope.page = 403
                    } else {
                        $scope.page = "content"
                    }
                }
            })

        } else {
            $scope.page = "login"
        }

    }, 1000)

    $scope.logout = (() => {
        localStorage.clear()
        location.href = "/#!/"
        location.reload()
    })
}])

app.controller('loginCtrl', ['$scope', '$timeout', '$http', ($scope, $timeout, $http) => {
    $scope.login = () => {
        $scope.error = ""

        const data = {
            username: $scope.username,
            password: $scope.password
        }

        $http.post(`/api/signin`, data).then((res) => {
            if(res.data.success) {
                localStorage.setItem("token", res.data.token)
                localStorage.setItem("account", XORCipher.encode(supersecret, JSON.stringify(res.data.data)))
                location.reload()
            } else {
                $scope.password = ""
                $scope.error = res.data.message || res.data
            }
        }, (err) => {
            $scope.password = ""
            $scope.error = err.data.message || err.data
        })
    }
}])

app.run(function($rootScope, $route) { 
    const blockUrl = ['/user', '/user/', '/user/create', '/user/create/']
    const account = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : { account_position: null }
    const hash = location.hash.replace('#!', '')

    if(!(account.account_position == 'admin')) {
        blockUrl.forEach((url) => {
            if(hash.match($route.routes[url].regexp)) {
                location.href = "/#!/"
                return 
            }
        })
    }
})

const generate_id = () => {
    return 'id-' + Math.random().toString(36).substr(2, 16)
}

function getBase64(file, callback) {
    var reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = function () {
        callback(reader.result)
    }
    reader.onerror = function (error) {
        callback(error)
    }
}

app.controller('userEditCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http', '$compile', '$sce',
    function($scope, $location, $route, $rootScope, $routeParams, $http, $compile, $sce) {
        $scope.selected_available_group = []
        $scope.selected_chosen_group = []

        $scope.available_group = []
        $scope.chosen_group = []
        
        $scope.is_edited = true
        $scope.tab_index = 1
        
        const tables = $('#datatable-responsive').DataTable({
            iDisplayLength: 10
        })

        $scope.is_owner = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))).account_id == $routeParams.id : false
        $scope.is_superuser = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))).account_position == 'admin' : false

        $scope.change_tab = (tab_index) => {
            $scope.tab_index = tab_index
            get_customers()
        }

        const get_type_file = (filename) => {
            const arr = filename.split('.')
            return arr[arr.length - 1]
        }

        $scope.query = {
            queryAvailableGroup: '',
            queryChosenGroup: ''
        }

        $scope.filterFn = (obj) => !$scope.query.queryAvailableGroup? true : obj.business_name.toLowerCase().search($scope.query.queryAvailableGroup) >= 0
        
        $scope.filterCg = (obj) => !$scope.query.queryChosenGroup? true : obj.business_name.toLowerCase().search($scope.query.queryChosenGroup) >= 0

        $scope.$watch('query.queryAvailableGroup', function() {
            $scope.selected_available_group = []
        })

        $scope.$watch('query.queryChosenGroup', function() {
            $scope.selected_chosen_group = []
        })

        $scope.getPathFile = (filename) => {
            return filename? '/static/files/'+filename : ''
        }

        $scope.onProfileChange = () => {
            getBase64($scope.account.account_photo_path, (res) => {
                $scope.$apply(function() {
                    $scope.profile_base64 = res
                })
            })
        }

        $scope.onClickChangeProfile = () => {
            $("#fileLoader").click()
        }

        const check_is_valid = () => {
            return $scope.account.account_position && $scope.account.account_phone && $scope.account.account_email && $scope.account.account_last_name && $scope.account.account_first_name
        }

        $http.get(`/api/account/${$routeParams.id}`).then((res) => {
            $scope.account = res.data.account[0]

            $scope.default_email = $scope.account.account_email
            $scope.default_password = $scope.account.account_password

            $scope.account.account_password = ''
        })

        $http.get(`/api/group/${$routeParams.id}`).then((res) => {
            $scope.chosen_group = res.data.groups
        })

        const get_group_from_id = (business_id) => {
            return $scope.available_group.find((group) => group.business_id == business_id)
        }

        $scope.on_click_add = () => {
            $scope.chosen_group = [ ...$scope.chosen_group , ...$scope.selected_available_group.map((id) => get_group_from_id(id))]
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
            get_customers()
        }

        $scope.on_click_remove = () => {
            $scope.chosen_group = $scope.chosen_group.filter((group) => {
                return $scope.selected_chosen_group.indexOf(group.business_id) < 0 
            })
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
            get_customers()
        }
        
        $scope.is_not_in_chosen_group = (business_id) => {
            return !$scope.chosen_group.find((group) => group.business_id == business_id)
        }

        $scope.on_click_group_in_chosen_group = (e, business_id) => {
            document.getSelection().removeAllRanges()
            const is_in_selected_chosen_group = $scope.is_in_selected_chosen_group(business_id)
            if(e.ctrlKey) {
                if(is_in_selected_chosen_group) {
                    const index = $scope.selected_chosen_group.indexOf(business_id)
                    $scope.selected_chosen_group.splice(index, 1)
                } else {
                    $scope.selected_chosen_group.push(business_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_chosen_group.length == 0) {
                    $scope.selected_chosen_group.push(business_id)
                } else {
                    const start_index =   $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id).indexOf($scope.selected_chosen_group[$scope.selected_chosen_group.length - 1])
                    const end_index = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id).indexOf(business_id)
                    console.log( start_index + ' - ' + end_index )
                    if(start_index <= end_index) {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return  index >= start_index && index <= end_index
                        }).map((customer) => customer.business_id)
                    } else {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return end_index >= index && index <= start_index
                        }).map((customer) => customer.business_id)
                    }
                }
            } else {
                $scope.selected_chosen_group = [business_id]
            }
        }

        $scope.on_click_group_in_available_group = (e, business_id) => {
            const is_in_selected_available_group = $scope.is_in_selected_available_group(business_id)
            document.getSelection().removeAllRanges()
            if(e.ctrlKey) {
                if(is_in_selected_available_group) {
                    const index = $scope.selected_available_group.indexOf(business_id)
                    $scope.selected_available_group.splice(index, 1)
                } else {
                    $scope.selected_available_group.push(business_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_available_group.length == 0) {
                    $scope.selected_available_group.push(business_id)
                } else {
                    const start_index =   $scope.available_group.filter($scope.filterFn).map((customer) => customer.business_id).indexOf($scope.selected_available_group[$scope.selected_available_group.length - 1])
                    const end_index = $scope.available_group.filter($scope.filterFn).map((customer) => customer.business_id).indexOf(business_id)
                    if(start_index <= end_index) {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return  index >= start_index && index <= end_index && $scope.is_not_in_chosen_group(value.business_id)
                        }).map((customer) => customer.business_id)
                    } else {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return end_index >= index && index <= start_index && $scope.is_not_in_chosen_group(value.business_id)
                        }).map((customer) => customer.business_id)
                    }
                }
            } else {
                $scope.selected_available_group = [business_id]
            }
        }

        $scope.on_select_all_available_group = () => {
            $scope.selected_available_group = $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.business_id)).filter($scope.filterFn).map((customer) => customer.business_id)
        }

        $scope.get_length_available_group = () => $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.business_id)).length
        
        $scope.on_select_all_chosen_group = () => {
            $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id)
        }

        $scope.is_in_selected_available_group = (business_id) => {
            return !!$scope.selected_available_group.find((id) => id == business_id)
        }
        
        $scope.is_in_selected_chosen_group = (business_id) => {
            return !!$scope.selected_chosen_group.find((id) => id == business_id)
        }

        $http.get(`/api/customers`).then((res) => {
            $scope.available_group = res.data
        })
        
        $scope.on_edit = () => {
            if(check_is_valid()) {
                $http.get('/api/check-account-id?account_email='+ $scope.account.account_email).then((res) => {
                    if(!res.data.is_used || $scope.account.account_email == $scope.default_email) {
                        const { correct, message } = validatePassword($scope.account.account_password)
                        if(correct) {
                            if($scope.account.account_password == $scope.account.account_confirm_password) {

                                if(typeof($scope.account.account_photo_path) != 'string') {
                                    const file = $scope.account.account_photo_path
                                    const filename = `${generate_id()}.${get_type_file(file.name)}`
                                    $scope.account.account_photo_path = filename
                    
                                    const formData = new FormData()
                                    formData.append('filename', filename)
                                    formData.append('fileupload', file)
                                    
                                    fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                        headers: {
                                            'x-access-token': localStorage.getItem("token")
                                        }
                                    })
                                    .then(response => response.json())
                                    .catch(error => console.error('Error:', error))
                                    .then(response => console.log('Success:', response))
                                }

                                $http.put(`/api/account/${$routeParams.id}`, $scope.account).then(() => {
                                    return $http.delete(`/api/user_group/${$scope.account.account_id}`)
                                }).then(() => {
                                    return $http.post(`/api/user_group/${$scope.account.account_id}`, {
                                        groups: $scope.chosen_group.map((group) => ({
                                            business_id: group.business_id
                                        }))
                                    })
                                }).then(() => {
                                    if($scope.is_superuser) {
                                        window.location.href = '/#!/user/'
                                    } else {
                                        window.location.href = '/#!/'
                                    }
                                })
                                $scope.error = ''
                            } else {
                                $scope.error = 'password เเละ confirm password ไม่ถูกต้อง'
                            }
                        } else if ($scope.account.account_password.length == 0) {

                            if(typeof($scope.account.account_photo_path) != 'string') {
                                const file = $scope.account.account_photo_path
                                const filename = `${generate_id()}.${get_type_file(file.name)}`
                                $scope.account.account_photo_path = filename
                
                                const formData = new FormData()
                                formData.append('filename', filename)
                                formData.append('fileupload', file)
                                
                                fetch('/api/upload', {
                                    method: 'POST',
                                    body: formData,
                                    headers: {
                                        'x-access-token': localStorage.getItem("token")
                                    }
                                })
                                .then(response => response.json())
                                .catch(error => console.error('Error:', error))
                                .then(response => console.log('Success:', response))
                            }
                            delete $scope.account.account_password
                            $http.put(`/api/account/${$routeParams.id}`, {
                                ...$scope.account
                            }).then(() => {
                                return $http.delete(`/api/user_group/${$scope.account.account_id}`)
                            }).then(() => {
                                return $http.post(`/api/user_group/${$scope.account.account_id}`, {
                                    groups: $scope.chosen_group.map((group) => ({
                                        business_id: group.business_id
                                    }))
                                })
                            }).then(() => {
                                if($scope.is_superuser) {
                                    window.location.href = '/#!/user/'
                                } else {
                                    window.location.href = '/#!/'
                                }
                            })
                            $scope.error = ''
                        } else {
                            $scope.error = $sce.trustAsHtml(message)
                        }
                    } else {
                        $scope.error = 'อีเมล์ถูกใช้ไปแเล้ว กรุณาเลือกใช้อีเมล์อื่น'
                    }
                })
               
            } else {
                $scope.error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
            }
        }

        const get_customers = () => {
            tables.clear()
            .draw()

            $scope.chosen_group.forEach((customer) => {
                const image = customer.business_logo_file? `/static/files/${customer.business_logo_file}` : '/static/images/user.png'
                tables.row.add( [
                    `
                    <ul class="list-inline">
                        <li>
                            <img src="${image}" class="avatar" alt="Avatar">
                        </li>
                    </ul>
                    `,
                    customer.business_id,
                    customer.business_name,
                    customer.business_grade,
                    customer.business_type,
                    customer.business_telephone || '-',
                    customer.business_region,
                    customer.executive_profile_name || '-',
                    customer.business_detail_pet_quantity || '-',
                    '<a href="/#!/customer/'+customer.business_id+'" class="btn btn-primary btn-xs"><i class="fa fa-folder"></i> View </a>'
                ]).draw( true )
            })

            var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
            compileFn($scope)
        }
    }
])

app.controller('userCreateCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http', '$sce',
    function($scope, $location, $route, $rootScope, $routeParams, $http, $sce) {
        $scope.selected_available_group = []
        $scope.selected_chosen_group = []

        $scope.available_group = []
        $scope.chosen_group = []

        $scope.is_superuser = true

        $scope.tab_index = 1
        
        $scope.change_tab = (tab_index) => {
            $scope.tab_index = tab_index
        }

        $scope.get_length_available_group = () => $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.business_id)).length
        
        $scope.filterFn = (obj) => !$scope.queryAvailableGroup? true : obj.business_name.toLowerCase().search($scope.queryAvailableGroup) >= 0

        $scope.filterCg = (obj) => !$scope.queryChosenGroup? true : obj.business_name.toLowerCase().search($scope.queryChosenGroup) >= 0

        $scope.$watch('queryAvailableGroup', function() {
            $scope.selected_available_group = []
        })

        $scope.$watch('queryChosenGroup', function() {
            $scope.selected_chosen_group = []
        })

        $scope.getPathFile = (filename) => {
            return filename? '/static/files/'+filename : ''
        }

        const get_type_file = (filename) => {
            const arr = filename.split('.')
            return arr[arr.length - 1]
        }

        $scope.onProfileChange = () => {
            getBase64($scope.account.account_photo_path, (res) => {
                $scope.$apply(function() {
                    $scope.profile_base64 = res
                })
            })
        }

        $scope.onClickChangeProfile = () => {
            $("#fileLoader").click()
        }

        $scope.on_create = () => {
            if(check_is_valid()) {
                $http.get('/api/check-account-id?account_email='+ $scope.account.account_email).then((res) => {
                    if(!res.data.is_used) {
                        const { correct, message } = validatePassword($scope.account.account_password)
                        if(correct) {
                            if($scope.account.account_password == $scope.account.account_confirm_password) {

                                if(typeof($scope.account.account_photo_path) != 'string') {
                                    const file = $scope.account.account_photo_path
                                    const filename = `${generate_id()}.${get_type_file(file.name)}`
                                    $scope.account.account_photo_path = filename
                    
                                    const formData = new FormData()
                                    formData.append('filename', filename)
                                    formData.append('fileupload', file)
                                    
                                    fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                        headers: {
                                            'x-access-token': localStorage.getItem("token")
                                        }
                                    })
                                    .then(response => response.json())
                                    .catch(error => console.error('Error:', error))
                                    .then(response => console.log('Success:', response))
                                }

                                $http.post(`/api/account`, $scope.account).then(() => {
                                    return $http.post(`/api/user_group/${$scope.account.account_id}`, {
                                        groups: $scope.chosen_group.map((group) => ({
                                            business_id: group.business_id
                                        }))
                                    })
                                }).then(() => {
                                    window.location.href = '/#!/user/'
                                })
                                $scope.error = ''
                            } else {
                                $scope.error = 'password เเละ confirm password ไม่ถูกต้อง'
                            }
                        } else {
                            $scope.error = $sce.trustAsHtml(message)
                        }
                    } else {
                        $scope.error = 'อีเมล์ถูกใช้ไปแเล้ว กรุณาเลือกใช้อีเมล์อื่น'
                    }
                })
               
            } else {
                $scope.error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
            }
        }

        const check_is_valid = () => {
            return $scope.account.account_position && $scope.account.account_password && $scope.account.account_phone && $scope.account.account_email && $scope.account.account_last_name && $scope.account.account_first_name
        }

        $scope.account = {
            account_id: generate_id(),
            account_position: '',
            account_password: '',
            account_phone: '',
            account_email: '',
            account_last_name: '',
            account_first_name: '',
            account_photo_path: ''
        }

        const get_group_from_id = (business_id) => {
            return $scope.available_group.find((group) => group.business_id == business_id)
        }

        $scope.on_click_add = () => {
            $scope.chosen_group = [ ...$scope.chosen_group , ...$scope.selected_available_group.map((id) => get_group_from_id(id))]
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }

        $scope.on_click_remove = () => {
            $scope.chosen_group = $scope.chosen_group.filter((group) => {
                return $scope.selected_chosen_group.indexOf(group.business_id) < 0 
            })
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }
        
        $scope.is_not_in_chosen_group = (business_id) => {
            return !$scope.chosen_group.find((group) => group.business_id == business_id)
        }

        $scope.on_click_group_in_chosen_group = (e, business_id) => {
            document.getSelection().removeAllRanges()
            const is_in_selected_chosen_group = $scope.is_in_selected_chosen_group(business_id)
            if(e.ctrlKey) {
                if(is_in_selected_chosen_group) {
                    const index = $scope.selected_chosen_group.indexOf(business_id)
                    $scope.selected_chosen_group.splice(index, 1)
                } else {
                    $scope.selected_chosen_group.push(business_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_chosen_group.length == 0) {
                    $scope.selected_chosen_group.push(business_id)
                } else {
                    const start_index =   $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id).indexOf($scope.selected_chosen_group[$scope.selected_chosen_group.length - 1])
                    const end_index = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id).indexOf(business_id)
                    console.log( start_index + ' - ' + end_index )
                    if(start_index <= end_index) {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return  index >= start_index && index <= end_index
                        }).map((customer) => customer.business_id)
                    } else {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return end_index >= index && index <= start_index
                        }).map((customer) => customer.business_id)
                    }
                }
            } else {
                $scope.selected_chosen_group = [business_id]
            }
        }

        $scope.on_click_group_in_available_group = (e, business_id) => {
            const is_in_selected_available_group = $scope.is_in_selected_available_group(business_id)
            document.getSelection().removeAllRanges()
            if(e.ctrlKey) {
                if(is_in_selected_available_group) {
                    const index = $scope.selected_available_group.indexOf(business_id)
                    $scope.selected_available_group.splice(index, 1)
                } else {
                    $scope.selected_available_group.push(business_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_available_group.length == 0) {
                    $scope.selected_available_group.push(business_id)
                } else {
                    const start_index = $scope.available_group.filter($scope.filterFn).map((customer) => customer.business_id).indexOf($scope.selected_available_group[$scope.selected_available_group.length - 1])
                    const end_index = $scope.available_group.filter($scope.filterFn).map((customer) => customer.business_id).indexOf(business_id)
                    if(start_index <= end_index) {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return  index >= start_index && index <= end_index && $scope.is_not_in_chosen_group(value.business_id)
                        }).map((customer) => customer.business_id)
                    } else {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return end_index >= index && index <= start_index && $scope.is_not_in_chosen_group(value.business_id)
                        }).map((customer) => customer.business_id)
                    }
                }
            } else {
                $scope.selected_available_group = [business_id]
            }
        }

        $scope.on_select_all_available_group = () => {
            $scope.selected_available_group = $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.business_id)).filter($scope.filterFn).map((customer) => customer.business_id)
        }

        $scope.on_select_all_chosen_group = () => {
            $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.business_id)
        }

        $scope.is_in_selected_available_group = (business_id) => {
            return !!$scope.selected_available_group.find((id) => id == business_id)
        }
        
        $scope.is_in_selected_chosen_group = (business_id) => {
            return !!$scope.selected_chosen_group.find((id) => id == business_id)
        }

        $http.get(`/api/customers`).then((res) => {
            $scope.available_group = res.data
        }) 
    }
])

app.controller('userCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http', '$compile',
    function($scope, $location, $route, $rootScope, $routeParams, $http, $compile) {
        const tables = $('#datatable-responsive').DataTable({
            iDisplayLength: 100,
            drawCallback: function() {
                var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
                compileFn($scope)
            }
        })
        
        $scope.on_delete = () => {
            $http.delete(`/api/account/${$scope.draft_delete_account_id}`).then(() => {
                load_user()
            })
        }

        $scope.draft_delete = (account_id) => {
            $scope.draft_delete_account_id = account_id
        }

        const load_user = () => {
            tables.clear()
            .draw()

            $http.get(`/api/account`).then((res) => {
                res.data.account.forEach((account) => {
                    const image = account.account_photo_path? `/static/files/${account.account_photo_path}` : '/static/images/user.png'
                    tables.row.add( [
                        `
                        <ul class="list-inline">
                            <li>
                                <img src="${image}" class="avatar" alt="Avatar">
                            </li>
                        </ul>
                        `,
                        account.account_first_name,
                        account.account_last_name,
                        account.account_email,
                        account.account_phone,
                        account.account_position,
                        account.account_updated,
                        '<a href="/#!/user/'+ account.account_id +'/edit" class="btn btn-info btn-xs"><i class="fa fa-pencil"></i> Edit </a>'+
                        `<a ng-click="draft_delete('${account.account_id}')" class="btn btn-danger btn-xs" data-toggle="modal" data-target="#remove-user"><i class="fa fa-trash-o"></i> Delete </a>`
                    ]).draw( true )
                })
    
                var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
                compileFn($scope)
            }) 
        }

        load_user()
    }
])

app.controller('editCustomerInfoCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http',
    function($scope, $location, $route, $rootScope, $routeParams, $http) {
        $scope.account = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : { account_position: null }
        $scope.is_superuser = $scope.account.account_position == 'admin'

        /** logic code for step 6 */

        $scope.selected_available_group = []
        $scope.selected_chosen_group = []

        $scope.available_group = []
        $scope.chosen_group = []

        $scope.query = {
            queryAvailableGroup: '',
            queryChosenGroup: ''
        }

        const get_group_from_id = (account_id) => {
            return $scope.available_group.find((group) => group.account_id == account_id)
        }

        $scope.filterFn = (obj) => !$scope.query.queryAvailableGroup? true : `${obj.account_first_name} ${obj.account_last_name}`.toLowerCase().search($scope.query.queryAvailableGroup) >= 0

        
        $scope.filterCg = (obj) => !$scope.query.queryChosenGroup? true : `${obj.account_first_name} ${obj.account_last_name}`.toLowerCase().search($scope.query.queryChosenGroup) >= 0

        $scope.$watch('query.queryAvailableGroup', function() {
            $scope.selected_available_group = []
        })

        $scope.$watch('query.queryChosenGroup', function() {
            $scope.selected_chosen_group = []
        })

        $scope.on_click_add = () => {
            $scope.chosen_group = [ ...$scope.chosen_group , ...$scope.selected_available_group.map((id) => get_group_from_id(id))]
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }

        $scope.on_click_remove = () => {
            $scope.chosen_group = $scope.chosen_group.filter((group) => {
                return $scope.selected_chosen_group.indexOf(group.account_id) < 0 
            })
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }
        
        $scope.is_not_in_chosen_group = (account_id) => {
            return !$scope.chosen_group.find((group) => group.account_id == account_id)
        }

        $scope.on_click_group_in_chosen_group = (e, account_id) => {
            document.getSelection().removeAllRanges()
            const is_in_selected_chosen_group = $scope.is_in_selected_chosen_group(account_id)
            if(e.ctrlKey) {
                if(is_in_selected_chosen_group) {
                    const index = $scope.selected_chosen_group.indexOf(account_id)
                    $scope.selected_chosen_group.splice(index, 1)
                } else {
                    $scope.selected_chosen_group.push(account_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_chosen_group.length == 0) {
                    $scope.selected_chosen_group.push(account_id)
                } else {
                    const start_index =   $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id).indexOf($scope.selected_chosen_group[$scope.selected_chosen_group.length - 1])
                    const end_index = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id).indexOf(account_id)
                    console.log( start_index + ' - ' + end_index )
                    if(start_index <= end_index) {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return  index >= start_index && index <= end_index
                        }).map((customer) => customer.account_id)
                    } else {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return end_index >= index && index <= start_index
                        }).map((customer) => customer.account_id)
                    }
                }
            } else {
                $scope.selected_chosen_group = [account_id]
            }
        }

        $scope.on_click_group_in_available_group = (e, account_id) => {
            const is_in_selected_available_group = $scope.is_in_selected_available_group(account_id)
            document.getSelection().removeAllRanges()
            if(e.ctrlKey) {
                if(is_in_selected_available_group) {
                    const index = $scope.selected_available_group.indexOf(account_id)
                    $scope.selected_available_group.splice(index, 1)
                } else {
                    $scope.selected_available_group.push(account_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_available_group.length == 0) {
                    $scope.selected_available_group.push(account_id)
                } else {
                    const start_index =   $scope.available_group.filter($scope.filterFn).map((customer) => customer.account_id).indexOf($scope.selected_available_group[$scope.selected_available_group.length - 1])
                    const end_index = $scope.available_group.filter($scope.filterFn).map((customer) => customer.account_id).indexOf(account_id)
                    if(start_index <= end_index) {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return  index >= start_index && index <= end_index && $scope.is_not_in_chosen_group(value.account_id)
                        }).map((customer) => customer.account_id)
                    } else {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return end_index >= index && index <= start_index && $scope.is_not_in_chosen_group(value.account_id)
                        }).map((customer) => customer.account_id)
                    }
                }
            } else {
                $scope.selected_available_group = [account_id]
            }
        }

        $scope.on_select_all_available_group = () => {
            $scope.selected_available_group = $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.account_id)).filter($scope.filterFn).map((customer) => customer.account_id)
        }

        $scope.get_length_available_group = () => $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.account_id)).length
        
        $scope.on_select_all_chosen_group = () => {
            $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id)
        }

        $scope.is_in_selected_available_group = (account_id) => {
            return !!$scope.selected_available_group.find((id) => id == account_id)
        }
        
        $scope.is_in_selected_chosen_group = (account_id) => {
            return !!$scope.selected_chosen_group.find((id) => id == account_id)
        }

        $http.get(`/api/account`).then((res) => {
            $scope.available_group = res.data.account
        }) 

        $http.get(`/api/user_group/${$routeParams.id}`).then((res) => {
            $scope.chosen_group = res.data.account
            $scope.old_group = res.data.account
        }) 

        /** logic code from step 1 - 5 */
        $scope.step = 1
        $scope.done = 6
        let default_business_id
        $scope.detail= {}

        $scope.account = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : { account_position: null }
        $scope.is_superuser = $scope.account.account_position == 'admin'

        $scope.getPathFile = (filename) => {
            return filename? '/static/files/'+filename : ''
        }

        $scope.onLogoChange = () => {
            getBase64($scope.detail.business_logo_file, (res) => {
                $scope.$apply(function() {
                    $scope.logo_base64 = res
                })
            })
        }

        $scope.onClickChangeLogo = () => {
            $("#fileLoader").click()
        }

        $http.get(`/api/customers/${$routeParams.id}`).then((res) => {
            $scope.detail = res.data[0]
            default_business_id = res.data[0].business_id

            $scope.detail.business_detail_pet_quantity = parseInt(res.data[0].business_detail_pet_quantity)
            $scope.detail.business_detail_meat_exchange_rate =  parseInt(res.data[0].business_detail_meat_exchange_rate)
            $scope.detail.business_detail_sixness_rate =  parseInt(res.data[0].business_detail_sixness_rate)
            $scope.detail.business_detail_mortality_rate =  parseInt(res.data[0].business_detail_mortality_rate)
            $scope.detail.business_detail_cpf_product_usage_rate =  parseInt(res.data[0].business_detail_cpf_product_usage_rate)
            $scope.detail.business_detail_other_product_usage_rate =  parseInt(res.data[0].business_detail_other_product_usage_rate)
            $scope.detail.business_detail_number_of_workers =  parseInt(res.data[0].business_detail_number_of_workers)

            $scope.detail.financial_information_private_capital_rate =  parseInt(res.data[0].financial_information_private_capital_rate)
            $scope.detail.financial_information_other_capital_rate =  parseInt(res.data[0].financial_information_other_capital_rate)
            
            $http.get(`api/child/${$routeParams.id}`).then((res) => {
                $scope.detail.child_additional = res.data.childs || []
            })
        }) 
        
        $scope.add_child = () => {
            $scope.detail.child_additional.push({
                child_profile_id: $scope.detail.business_id,
                child_profile_name: '',
                child_profile_age: '',
                child_profile_sex: 'male',
                child_profile_career: '',
                child_profile_experience: '',
                child_profile_education: '',
            })
        }

        $scope.remove_child = () => {
            console.log('-11')
            $scope.detail.child_additional.splice($scope.detail.child_additional.length - 1, 1)
        }

        const next_step = () => {
            $scope.step = $scope.step + 1
            window.scrollTo(0, 0)

            if($scope.step > $scope.done) {
                $scope.done = $scope.step
            }
        }

        $scope.click_next = () => {
            if($scope.step == 1) {
                if($scope.check_form_valid()) {
                    if(default_business_id == $scope.detail.business_id) {
                        $scope.error = ''
                        next_step()
                    } else {
                        $http.get('/api/check-customer-id?business_id=' + $scope.detail.business_id, $scope.detail).then((res) => {
                            $scope.error = res.data.is_used? 'รหัสลูกค้าถูกใช้เเล้ว': ''
                            if(!$scope.error) next_step()
                        })
                    }
                } else {
                    $scope.error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
                    return
                }
            } else if ($scope.step < ($scope.is_superuser? 6 : 5)) {
                next_step()
            }
        }

        $scope.check_form_valid = () => {
            return $scope.detail.business_id && $scope.detail.business_name && $scope.detail.business_address && $scope.detail.business_telephone
        }

        $scope.can_save = () => {
            return $scope.check_form_valid() && $scope.done == 6
        }

        $scope.click_previous = () => {
            if($scope.step > 1) {
                $scope.step = $scope.step - 1   
                window.scrollTo(0, 0)             
            }
        }

        $scope.go_to_step = (step) => {
            if(step <= $scope.done) {
                $scope.step = step
                window.scrollTo(0, 0)                
            }
        }

        const get_type_file = (filename) => {
            const arr = filename.split('.')
            return arr[arr.length - 1]
        }

        const on_call_api = (user_ids) => {

            if(typeof($scope.detail.business_detail_file) != 'string') {
                const file = $scope.detail.business_detail_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_detail_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if(typeof($scope.detail.goal_file_name) != 'string') {
                const file = $scope.detail.goal_file_name
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.goal_file_name = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if(typeof($scope.detail.business_logo_file) != 'string') {
                const file = $scope.detail.business_logo_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_logo_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if(typeof($scope.detail.financial_information_cpf_feed_purchase_file) != 'string') {
                const file = $scope.detail.financial_information_cpf_feed_purchase_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.financial_information_cpf_feed_purchase_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if(typeof($scope.detail.business_detail_pet_file) != 'string') {
                const file = $scope.detail.business_detail_pet_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_detail_pet_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            $http.put(`/api/customers/${$routeParams.id}`, { 
                ...$scope.detail,
                user_ids: user_ids
            }).then(() => {
                $http.delete(`api/child/${$routeParams.id}`).then(() => {
                    $http.post('api/child', {
                        child: $scope.detail.child_additional
                    }).then(() => {
                        window.location.href = '/#!/customer/' + $scope.detail.business_id                  
                    })
                })
            })
        }

        $scope.$watchGroup([
            'detail.business_detail_pet_type1_selected',
            'detail.business_detail_pet_type2_selected',
            'detail.business_detail_pet_type3_selected',
            'detail.business_detail_pet_type4_selected',
            'detail.business_detail_pet_type5_selected',
            'detail.business_detail_pet_type6_selected',
            'detail.business_detail_pet_other_selected',

            'detail.business_detail_pet_type1_amount',
            'detail.business_detail_pet_type2_amount',
            'detail.business_detail_pet_type3_amount',
            'detail.business_detail_pet_type4_amount',
            'detail.business_detail_pet_type5_amount',
            'detail.business_detail_pet_type6_amount',
            'detail.business_detail_pet_other_amount',
        ], 
            function(newValues, oldValues, scope) {
            let sum = 0
            if($scope.detail.business_detail_pet_type1_selected) {
                sum = sum + $scope.detail.business_detail_pet_type1_amount
            }
            if($scope.detail.business_detail_pet_type2_selected) {
                sum = sum + $scope.detail.business_detail_pet_type2_amount
            }
            if($scope.detail.business_detail_pet_type3_selected) {
                sum = sum + $scope.detail.business_detail_pet_type3_amount
            }
            if($scope.detail.business_detail_pet_type4_selected) {
                sum = sum + $scope.detail.business_detail_pet_type4_amount
            }
            if($scope.detail.business_detail_pet_type5_selected) {
                sum = sum + $scope.detail.business_detail_pet_type5_amount
            }
            if($scope.detail.business_detail_pet_type6_selected) {
                sum = sum + $scope.detail.business_detail_pet_type6_amount
            }
            if($scope.detail.business_detail_pet_other_selected) {
                sum = sum + $scope.detail.business_detail_pet_other_amount
            }
            $scope.detail.business_detail_pet_quantity = sum
        })

        $scope.on_create = () => {
            const available_group = $scope.available_group.map((r) => r.account_id)
            const chosen_group = $scope.chosen_group.map((r) => r.account_id)
            const old_group = $scope.old_group.map((r) => r.account_id)

            const user_ids = {
                delete: [],
                insert: []
            }

            available_group.forEach((id) => {
                const is_in_chosen_group = chosen_group.indexOf(id) >= 0
                const is_in_old_group = old_group.indexOf(id) >= 0
                if(is_in_chosen_group && is_in_old_group) {

                } else if(!is_in_chosen_group && is_in_old_group) {
                    /** delete user from group */
                    user_ids.delete.push(id)
                } else if(is_in_chosen_group && !is_in_old_group) {
                    /** add user to group */
                    user_ids.insert.push(id)
                } else {

                }
            })

            $scope.detail.goal_id = $scope.detail.business_detail_id = $scope.detail.executive_profile_id = $scope.detail.financial_information_id = $scope.detail.business_id
            
            if(default_business_id == $scope.detail.business_id) {
                on_call_api(user_ids)
            } else {
                $http.get('/api/check-customer-id?business_id=' + $scope.detail.business_id, $scope.detail).then((res) => {
                    $scope.error = res.data.is_used? 'รหัสลูกค้าถูกใช้เเล้ว': ''
                    if(!$scope.error) {
                        on_call_api(user_ids)
                    }
                })
            }
            
        }
    }
])

app.controller('customerInfoCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http', '$compile',
    function($scope, $location, $route, $rootScope, $routeParams, $http, $compile) {
        $scope.tab_index = 1
        $scope.token = localStorage.getItem("token")

        $scope.change_tab = (tab_index) => {
            $scope.tab_index = tab_index
            load_user()
        }

        const load_user = () => {
            const tables = $('#datatable-responsive').DataTable()
            tables.clear()
            .draw()

            $http.get(`/api/user_group/${$routeParams.id}`).then((res) => {
                res.data.account.forEach((account) => {
                    tables.row.add( [
                        account.account_first_name,
                        account.account_last_name,
                        account.account_email,
                        account.account_phone,
                        account.account_position,
                        '<a href="/#!/user/'+account.account_id+'/edit" class="btn btn-primary btn-xs"><i class="fa fa-folder"></i> View </a>'
                    ]).draw( true )
                })
                var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
                compileFn($scope)
            }) 
        }

        $scope.redirect_to_edit = () => {
            window.location.href = '/#!/customer/' + $scope.detail.business_id + '/edit'
        }

        $http.get(`/api/customers/${$routeParams.id}`).then((res) => {
            $scope.detail = res.data[0] || {}

            $http.get(`api/child/${$routeParams.id}`).then((res) => {
                $scope.detail.child_additional = res.data.childs || []
            })
        })

        $scope.sex_matched = {
            male: 'ชาย',
            female: 'หญิง'
        }

        $scope.status_matched = {
            single: 'โสด',
            engaged: 'หมั้น',
            maried: 'แต่งงาน',
            divorce: 'หย่า'
        }

        $scope.message_with_percent = (message) => {
            return message? `${message} %` : ``
        }
    }
])

app.controller('customersCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http', '$compile',
    function($scope, $location, $route, $rootScope, $routeParams, $http, $compile) {
        const tables = $('#datatable-responsive').DataTable({
            drawCallback: function() {
                var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
                compileFn($scope)
            }
        })

        $scope.on_delete_customer = () => {
            $http.delete(`/api/customers/${$scope.draft_delete_business_id}`).then(() => {
                get_customers()
            })
        }
        const acccount = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : { account_position : null }
        const token = localStorage.getItem("token")
        $scope.is_superuser = acccount.account_position == 'admin'

        function getActionHtml(customer) {
            let action = '<a target="_blank" href="/api/pdf/'+customer.business_id+'?token='+token+'" class="btn btn-primary btn-xs"><i class="fa fa-file-pdf-o"></i> PDF </a>' +
            '<a href="/#!/customer/'+customer.business_id+'" class="btn btn-info btn-xs"><i class="fa fa-folder"></i> View </a>' +
            '<a href="/#!/customer/'+customer.business_id+'/edit" class="btn btn-warning btn-xs"><i class="fa fa-pencil"></i> Edit </a>'

            if($scope.is_superuser) {
                action = action +  `<a ng-click="draft_delete('${customer.business_id}')" class="btn btn-danger btn-xs" data-toggle="modal" data-target="#remove-customer"><i class="fa fa-trash-o"></i> Delete </a>`
            }
            return action
        }

        $scope.draft_delete = (business_id) => {
            $scope.draft_delete_business_id = business_id
        }

        $scope.create_pdf_all = () => {
            const url = `/api/pdf?query=${$scope.query}&business_customer_type=${$scope.business_customer_type}&business_type=${$scope.business_type}&business_grade=${$scope.business_grade}&amount_of_pets_min=${$scope.amount_of_pets_min}&amount_of_pets_max=${$scope.amount_of_pets_max}&business_region=${$scope.business_region}&token=${token}`
            window.open(url, '_blank')
        }

        const get_customers = () => {
            tables.clear()
            .draw()

            return $http.get(`/api/customers?query=${$scope.query}&business_customer_type=${$scope.business_customer_type}&business_type=${$scope.business_type}&business_grade=${$scope.business_grade}&amount_of_pets_min=${$scope.amount_of_pets_min}&amount_of_pets_max=${$scope.amount_of_pets_max}&business_region=${$scope.business_region}`).then((res) => {
                res.data.forEach((customer) => {
                    const image = customer.business_logo_file? `/static/files/${customer.business_logo_file}` : '/static/images/user.png'
                    tables.row.add( [
                        `
                        <ul class="list-inline">
                            <li>
                                <img src="${image}" class="avatar" alt="Avatar">
                            </li>
                        </ul>
                        `,
                        customer.business_id,
                        customer.business_name,
                        customer.business_grade,
                        customer.business_type,
                        $scope.get_label_customer_type(customer.business_customer_type),
                        customer.business_region,
                        customer.executive_profile_name,
                        customer.business_detail_pet_quantity,
                        getActionHtml(customer)
                    ]).draw( true )
                })

                var compileFn = $compile(angular.element(document.getElementById("datatable-responsive")))
                compileFn($scope)
            })
        }  

        $scope.get_label_customer_type = (business_customer_type) => {
            return business_customer_type == 'key_account'? 'Key account' : 'General account'
        }

        $scope.init_query = () => {
            $scope.query = ''
            $scope.business_type = ''
            $scope.business_grade = ''
            $scope.amount_of_pets_min = ''
            $scope.amount_of_pets_max = ''
            $scope.business_region = ''
            $scope.business_customer_type = ''
            get_customers()
        }

        $scope.init_query()

        $scope.on_search = () => {
            get_customers()
        }
    }
])

app.controller('createCustomerInfoCtrl', [
    '$scope', '$location', '$route', '$rootScope', '$routeParams', '$http',
    function($scope, $location, $route, $rootScope, $routeParams, $http) {

        const account = localStorage.getItem("account") ? JSON.parse(XORCipher.decode(supersecret, localStorage.getItem("account"))) : { account_position : null }
        const token = localStorage.getItem("token")
        $scope.is_superuser = account.account_position == 'admin'
        
        /** logic code for step 6 */

        $scope.selected_available_group = []
        $scope.selected_chosen_group = []

        $scope.available_group = []
        $scope.chosen_group = $scope.is_superuser? [] : [{ account_id: account.account_id }]

        $scope.query = {
            queryAvailableGroup: '',
            queryChosenGroup: ''
        }

        const get_group_from_id = (account_id) => {
            return $scope.available_group.find((group) => group.account_id == account_id)
        }

        $scope.filterFn = (obj) => !$scope.query.queryAvailableGroup? true : `${obj.account_first_name} ${obj.account_last_name}`.toLowerCase().search($scope.query.queryAvailableGroup) >= 0

        
        $scope.filterCg = (obj) => !$scope.query.queryChosenGroup? true : `${obj.account_first_name} ${obj.account_last_name}`.toLowerCase().search($scope.query.queryChosenGroup) >= 0

        $scope.$watch('query.queryAvailableGroup', function() {
            $scope.selected_available_group = []
        })

        $scope.$watch('query.queryChosenGroup', function() {
            $scope.selected_chosen_group = []
        })

        $scope.on_click_add = () => {
            $scope.chosen_group = [ ...$scope.chosen_group , ...$scope.selected_available_group.map((id) => get_group_from_id(id))]
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }

        $scope.on_click_remove = () => {
            $scope.chosen_group = $scope.chosen_group.filter((group) => {
                return $scope.selected_chosen_group.indexOf(group.account_id) < 0 
            })
            $scope.selected_available_group = []
            $scope.selected_chosen_group = []
        }
        
        $scope.is_not_in_chosen_group = (account_id) => {
            return !$scope.chosen_group.find((group) => group.account_id == account_id)
        }

        $scope.on_click_group_in_chosen_group = (e, account_id) => {
            document.getSelection().removeAllRanges()
            const is_in_selected_chosen_group = $scope.is_in_selected_chosen_group(account_id)
            if(e.ctrlKey) {
                if(is_in_selected_chosen_group) {
                    const index = $scope.selected_chosen_group.indexOf(account_id)
                    $scope.selected_chosen_group.splice(index, 1)
                } else {
                    $scope.selected_chosen_group.push(account_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_chosen_group.length == 0) {
                    $scope.selected_chosen_group.push(account_id)
                } else {
                    const start_index =   $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id).indexOf($scope.selected_chosen_group[$scope.selected_chosen_group.length - 1])
                    const end_index = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id).indexOf(account_id)
                    console.log( start_index + ' - ' + end_index )
                    if(start_index <= end_index) {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return  index >= start_index && index <= end_index
                        }).map((customer) => customer.account_id)
                    } else {
                        $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).filter((value, index) => {
                            return end_index >= index && index <= start_index
                        }).map((customer) => customer.account_id)
                    }
                }
            } else {
                $scope.selected_chosen_group = [account_id]
            }
        }

        $scope.on_click_group_in_available_group = (e, account_id) => {
            const is_in_selected_available_group = $scope.is_in_selected_available_group(account_id)
            document.getSelection().removeAllRanges()
            if(e.ctrlKey) {
                if(is_in_selected_available_group) {
                    const index = $scope.selected_available_group.indexOf(account_id)
                    $scope.selected_available_group.splice(index, 1)
                } else {
                    $scope.selected_available_group.push(account_id)
                }
            } else if(e.shiftKey) {
                if($scope.selected_available_group.length == 0) {
                    $scope.selected_available_group.push(account_id)
                } else {
                    const start_index =   $scope.available_group.filter($scope.filterFn).map((customer) => customer.account_id).indexOf($scope.selected_available_group[$scope.selected_available_group.length - 1])
                    const end_index = $scope.available_group.filter($scope.filterFn).map((customer) => customer.account_id).indexOf(account_id)
                    if(start_index <= end_index) {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return  index >= start_index && index <= end_index && $scope.is_not_in_chosen_group(value.account_id)
                        }).map((customer) => customer.account_id)
                    } else {
                        $scope.selected_available_group = $scope.available_group.filter($scope.filterFn).filter((value, index) => {
                            return end_index >= index && index <= start_index && $scope.is_not_in_chosen_group(value.account_id)
                        }).map((customer) => customer.account_id)
                    }
                }
            } else {
                $scope.selected_available_group = [account_id]
            }
        }

        $scope.on_select_all_available_group = () => {
            $scope.selected_available_group = $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.account_id)).filter($scope.filterFn).map((customer) => customer.account_id)
        }

        $scope.get_length_available_group = () => $scope.available_group.filter((value) => $scope.is_not_in_chosen_group(value.account_id)).length
        
        $scope.on_select_all_chosen_group = () => {
            $scope.selected_chosen_group = $scope.chosen_group.filter($scope.filterCg).map((customer) => customer.account_id)
        }

        $scope.is_in_selected_available_group = (account_id) => {
            return !!$scope.selected_available_group.find((id) => id == account_id)
        }
        
        $scope.is_in_selected_chosen_group = (account_id) => {
            return !!$scope.selected_chosen_group.find((id) => id == account_id)
        }

        $http.get(`/api/account`).then((res) => {
            $scope.available_group = res.data.account
        }) 

        /** logic code from step 1 - 5 */
        $scope.step = 1
        $scope.done = 1

        const next_step = () => {
            $scope.step = $scope.step + 1
            window.scrollTo(0, 0)

            if($scope.step > $scope.done) {
                $scope.done = $scope.step
            }
        }

        $scope.click_next = () => {
            if($scope.step == 1) {
                if($scope.check_form_valid()) {
                    $http.get('/api/check-customer-id?business_id=' + $scope.detail.business_id, $scope.detail).then((res) => {
                        $scope.error = res.data.is_used? 'รหัสลูกค้าถูกใช้เเล้ว': ''
                        if(!$scope.error) next_step()
                    })
                } else {
                    $scope.error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
                    return
                }
            } else if ($scope.step < ($scope.is_superuser? 6 : 5)) {
                next_step()
            }
        }

        $scope.check_form_valid = () => {
            return $scope.detail.business_id && $scope.detail.business_name && $scope.detail.business_address && $scope.detail.business_telephone
        }

        $scope.can_save = () => {
            return $scope.check_form_valid() && $scope.done == ($scope.is_superuser? 6 : 5)
        }

        $scope.click_previous = () => {
            if($scope.step > 1) {
                $scope.step = $scope.step - 1   
                window.scrollTo(0, 0)             
            }
        }

        $scope.go_to_step = (step) => {
            if(step <= $scope.done) {
                $scope.step = step
                window.scrollTo(0, 0)                
            }
        }

        const get_type_file = (filename) => {
            const arr = filename.split('.')
            return arr[arr.length - 1]
        }
        

        $scope.onLogoChange = () => {
            getBase64($scope.detail.business_logo_file, (res) => {
                $scope.$apply(function() {
                    $scope.logo_base64 = res
                })
            })
        }

        $scope.onClickChangeLogo = () => {
            $("#fileLoader").click()
        }

        $scope.on_create = () => {
            $scope.detail.goal_id = $scope.detail.business_detail_id = $scope.detail.executive_profile_id = $scope.detail.financial_information_id = $scope.detail.business_id
            
            if($scope.detail.business_detail_file) {
                const file = $scope.detail.business_detail_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_detail_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if($scope.detail.goal_file_name) {
                const file = $scope.detail.goal_file_name
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.goal_file_name = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if($scope.detail.business_logo_file) {
                const file = $scope.detail.business_logo_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_logo_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if($scope.detail.business_detail_pet_file) {
                const file = $scope.detail.business_detail_pet_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.business_detail_pet_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            if($scope.detail.financial_information_cpf_feed_purchase_file) {
                const file = $scope.detail.financial_information_cpf_feed_purchase_file
                const filename = `${generate_id()}.${get_type_file(file.name)}`
                $scope.detail.financial_information_cpf_feed_purchase_file = filename

                const formData = new FormData()
                formData.append('filename', filename)
                formData.append('fileupload', file)
                
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-access-token': localStorage.getItem("token")
                    }
                })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
                .then(response => console.log('Success:', response))
            }

            const data = {
                ...$scope.detail,
                users: $scope.chosen_group.map((user) => ({
                    account_id: user.account_id
                }))
            }
            $http.post('/api/customers', data).then(() => {
                $http.delete(`api/child/${$scope.detail.business_id}`).then(() => {
                    $http.post('api/child', {
                        child: $scope.detail.child_additional
                    }).then(() => {
                        window.location.href = '/#!/customer/' + $scope.detail.business_id                    
                    })
                })
            })
        }

        $scope.add_child = () => {
            $scope.detail.child_additional.push({
                child_profile_id: $scope.detail.business_id,
                child_profile_name: '',
                child_profile_age: '',
                child_profile_sex: 'male',
                child_profile_career: '',
                child_profile_experience: '',
                child_profile_education: '',
            })
        }

        $scope.remove_child = () => {
            $scope.detail.child_additional.splice($scope.detail.child_additional.length - 1, 1)
        }

        $scope.getPathFile = (filename) => {
            return filename? '/static/files/'+filename : ''
        }

        function randomString() {
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZ";
            var string_length = 2;
            var randomstring = '';
            for (var i=0; i<string_length; i++) {
                var rnum = Math.floor(Math.random() * chars.length);
                randomstring += chars.substring(rnum,rnum+1);
            }
            return randomstring
        }

        function randomNumber() {
            var chars = "0123456789";
            var string_length = 6;
            var randomstring = '';
            for (var i=0; i<string_length; i++) {
                var rnum = Math.floor(Math.random() * chars.length);
                randomstring += chars.substring(rnum,rnum+1);
            }
            return randomstring
        }

        const id = `${randomString()}-${randomNumber()}`

        $scope.$watchGroup([
            'detail.business_detail_pet_type1_selected',
            'detail.business_detail_pet_type2_selected',
            'detail.business_detail_pet_type3_selected',
            'detail.business_detail_pet_type4_selected',
            'detail.business_detail_pet_type5_selected',
            'detail.business_detail_pet_type6_selected',
            'detail.business_detail_pet_other_selected',

            'detail.business_detail_pet_type1_amount',
            'detail.business_detail_pet_type2_amount',
            'detail.business_detail_pet_type3_amount',
            'detail.business_detail_pet_type4_amount',
            'detail.business_detail_pet_type5_amount',
            'detail.business_detail_pet_type6_amount',
            'detail.business_detail_pet_other_amount',
        ], 
            function(newValues, oldValues, scope) {
            let sum = 0
            if($scope.detail.business_detail_pet_type1_selected) {
                sum = sum + $scope.detail.business_detail_pet_type1_amount
            }
            if($scope.detail.business_detail_pet_type2_selected) {
                sum = sum + $scope.detail.business_detail_pet_type2_amount
            }
            if($scope.detail.business_detail_pet_type3_selected) {
                sum = sum + $scope.detail.business_detail_pet_type3_amount
            }
            if($scope.detail.business_detail_pet_type4_selected) {
                sum = sum + $scope.detail.business_detail_pet_type4_amount
            }
            if($scope.detail.business_detail_pet_type5_selected) {
                sum = sum + $scope.detail.business_detail_pet_type5_amount
            }
            if($scope.detail.business_detail_pet_type6_selected) {
                sum = sum + $scope.detail.business_detail_pet_type6_amount
            }
            if($scope.detail.business_detail_pet_other_selected) {
                sum = sum + $scope.detail.business_detail_pet_other_amount
            }
            $scope.detail.business_detail_pet_quantity = sum
        })

        $scope.detail = {
            goal_id: '',
            goal_detail: '',
            goal_file_name: '',

            business_detail_id: '',
            business_detail_pet_quantity: 0,
            business_detail_pet_file: '',
            business_detail_pet_type1_amount: 0,
            business_detail_pet_type1_selected: false,
            business_detail_pet_type2_amount: 0,
            business_detail_pet_type2_selected: false,
            business_detail_pet_type3_amount: 0,
            business_detail_pet_type3_selected: false,
            business_detail_pet_type4_amount: 0,
            business_detail_pet_type4_selected: false,
            business_detail_pet_type5_amount: 0,
            business_detail_pet_type5_selected: false,
            business_detail_pet_type6_amount: 0,
            business_detail_pet_type6_selected: false,
            business_detail_pet_other_amount: 0,
            business_detail_pet_other_detail: '',
            business_detail_pet_other_selected: false,

            business_detail_type1_fcr: 0,
            business_detail_type1_adg: 0,
            business_detail_type1_die_rate: 0,
            business_detail_type1_sick_rate: 0,

            business_detail_type2_born_rate: 0,
            business_detail_type2_die_rate: 0,
            business_detail_type2_sick_rate: 0,

            business_detail_type3_egg_rate: 0,
            business_detail_type3_die_rate: 0,
            business_detail_type3_sick_rate: 0,

            business_detail_type4_fcr: 0,
            business_detail_type4_die_rate: 0,
            business_detail_type4_sick_rate: 0,

            business_detail_cpf_product_usage_rate: '',
            business_detail_other_product_usage_rate: '',
            business_detail_sales_chanels_for_cpf: '',
            business_detail_sales_chanels_for_other: '',
            business_detail_number_of_workers: '',
            business_detail_competitor: '',
            business_detail_market_condition_and_solutions: '',
            business_detail_file: '',
            
            executive_profile_id: '',
            executive_profile_name: '',
            executive_profile_age: '',
            executive_profile_sex: 'male',
            executive_profile_education: '',
            executive_profile_status: 'single',
            executive_profile_career: '',
            executive_profile_experience: '',

            child_profile_name: '',
            child_profile_age: '',
            child_profile_sex: 'male',
            child_profile_career: '',
            child_profile_experience: '',
            child_profile_education: '',

            spouse_profile_name: '',
            spouse_profile_age: '',
            spouse_profile_education: '',
            spouse_profile_career: '',
            spouse_profile_experience: '',

            
            financial_information_id: '',
            financial_information_payment_history: '',
            financial_information_credit_from_cpf: '',
            financial_information_credit_from_competitor: '',
            financial_information_private_capital_rate: '',
            financial_information_other_capital_rate: '',
            financial_information_asset_land: '',
            financial_information_asset_car: '',
            financial_information_asset_other: '',
            financial_information_debt: '',
            financial_information_main_revenue: '',
            financial_information_other_income: '',
            financial_information_cpf_feed_purchase: '',
            financial_information_cpf_feed_purchase_file: '',
            financial_information_other_feed_purchase: '',
            financial_information_breeding_grounds: '',
            financial_information_price_of_animals: '',
            financial_information_quantity_of_animals_purchase: '',

            business_id: id,
            business_name: '',
            business_grade: 'bronze',
            business_address: '',
            business_region: 'เหนือ',
            business_type: 'นิติบุคคล',
            business_logo_file: '',
            business_telephone: '',
            business_customer_type: 'key_account',

            child_additional: []
        }
    }
])
