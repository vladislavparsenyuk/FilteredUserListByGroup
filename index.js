; (function ($, moment) {
    'use strict';


    var TEST = false;

    var defaults = {
        url: ASP.Urls.UserList,
        title: ASP.Labels.Users,
        container: '#main',
        filterList: null, // ['name', 'age', 'demos']
    };

    var alphabet = {
        'en-US': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
        'nb-NO': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'æ', 'ø', 'å'],
    }[ASP.Locale];

    var defaultFilters = [
        {
            type: 'name',
            name: ASP.Labels.Name,
            values: alphabet.map(char => ({ value: char, text: char.toUpperCase() })),
        },
        {
            type: 'age',
            name: ASP.Labels.AgeGroup,
            values: [
                { value: '0-20', text: ASP.Labels.UserListFilterAge_less_20 },
                { value: '20-40', text: ASP.Labels.UserListFilterAge_20_40 },
                { value: '40-60', text: ASP.Labels.UserListFilterAge_40_60 },
                { value: '60-80', text: ASP.Labels.UserListFilterAge_60_80 },
                { value: '80-500', text: ASP.Labels.UserListFilterAge_80_more },
                { value: '2000-Infinity', text: ASP.Labels.UserListFilterAge_none },
            ],
        },
        {
            type: 'demos',
            name: ASP.Labels.HealthHelper,
            values: [],
        },
    ];


    class UserList extends BaseView {

        constructor(options) {
            super();
            this.settings = $.extend({}, defaults, options);
            this.template = new UserListTemplate;
            this.$root = null;
            this.data = {};
            this.filters = [];
            this.init();
        }

        init() {
            this.$root = $(this.template.root(this.settings)).appendTo(this.settings.container);

            this.$root
                .on('change', '[name="filter"]', this.changeFilter.bind(this))
                .on('change', '[name="subfilter"]', this.filter.bind(this))
                .on('input', '[name="search"]', this.filter.bind(this));

            this.refresh();
        }

        refresh() {
            this.getData().done(() => {
                this.$root.find('.content').empty().append(this.template.content(this.filters));
                this.$root.find('select').dropdownSelector();
                this.changeFilter();
            });
        }

        getData() {
            return $.ajax({
                type: 'get',
                url: TEST ? '/TestData/UserList.json' : this.settings.url,
                cache: false,
            })
            .done(this.processData.bind(this))
            .fail(this.fail)
            .promise();
        }

        processData(data) {
            this.data = data;
            this.prepareUsers();
            this.prepareFilters();
        }

        prepareUsers() {
            this.data.users = this.data.items
                .map(user => {
                    user.char = user.name.charAt(0).toLowerCase();
                    user.age = moment().diff(moment(user.birthday, ASP.DateFormat), 'years');
                    return user;
                })
                .sort((a, b) => {
                    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
                });
        }

        prepareFilters() {
            this.filters = this.settings.filterList
                ? defaultFilters.filter(f => this.settings.filterList.some(type => f.type == type))
                : this.filters = defaultFilters;

            this.filters.forEach(filter => {
                switch (filter.type) {
                    case 'name':
                        filter.values.forEach(v => {
                            v.disabled = !this.data.users.some(user => user.char == v.value);
                        });
                        break;

                    case 'age':
                        filter.values.forEach(v => {
                            var minMax = v.value.split('-');
                            v.disabled = !this.data.users.some(user => {
                                return minMax[0] <= user.age && user.age <= minMax[1];
                            });
                        });
                        break;

                    case 'demos':
                        this.data.users.forEach(user => {
                            user.demoses.forEach(demos => {
                                var isInList = filter.values.some(v => v.value == demos.name);
                                if (!isInList) {
                                    filter.values.push({
                                        text: demos.name,
                                        value: demos.name,
                                    });
                                }
                            });
                        });
                        filter.values.sort((a, b) => a.value.toLowerCase() < b.value.toLowerCase() ? -1 : 1);
                        break;
                }
            });
        }

        changeFilter() {
            var filterType = this.$root.find('[name="filter"]').val();
            var $subFilter = this.$root.find('.user-sub-filter');
            var filter = this.filters.filter(f => f.type == filterType)[0];

            $subFilter.replaceWith(this.template.subFilter(filter));

            this.filter();
        }

        filter() {
            var $userGroups = this.$root.find('.user-groups');
            var filterType = this.$root.find('[name="filter"]').val();
            var subfilters = this.$root.find('[name="subfilter"]:checked').toArray().map(check => check.value);
            var search = this.$root.find('[name="search"]').val().trim().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            var searchRegex = new RegExp(search, 'i');

            var filter = this.filters.filter(f => f.type == filterType)[0];
            var filterValues = filter.values.filter(filterVal => {
                return subfilters.length
                    ? subfilters.some(sub => sub == filterVal.value)
                    : !filterVal.disabled;
            });
            
            var checkFilter = (user, val) => {
                switch (filterType) {
                    case 'name':
                        return user.char == val;
                    case 'age':
                        var minMax = val.split('-');
                        return minMax[0] <= user.age && user.age <= minMax[1];
                    case 'demos':
                        return user.demoses.some(d => d.name == val);
                }
            }
            var checkSearch = (user) => {
                return searchRegex.test(user.name)
                    || searchRegex.test(user.birthday)
                    || user.demoses.some(d => searchRegex.test(d.name) || searchRegex.test(d.medication));
            }

            var userGroups = {};

            for (let filterVal of filterValues) {
                let val = filterVal.value;

                for (let user of this.data.users) {
                    if (checkFilter(user, val) && checkSearch(user)) {
                        userGroups[val] = userGroups[val] || {
                            groupName: filterVal.text,
                            search: search,
                            users: [],
                        };
                        userGroups[val].users.push(user);
                    }
                }
            }

            $userGroups.replaceWith(this.template.userGroups(userGroups));
        }

    }


    window.UserList = UserList;


})(jQuery, moment);